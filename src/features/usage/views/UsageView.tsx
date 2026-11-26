import { clsx } from 'clsx'
import { useCallback, useEffect, useState } from 'react'
import { MdDeleteOutline, MdDeleteSweep, MdEdit, MdKeyboardArrowDown, MdKeyboardArrowRight, MdMoreHoriz, MdPlayArrow, MdPushPin, MdOutlinePushPin } from 'react-icons/md'
import type { AgentUsage, LimitInfo, SessionInfo, UsageData } from '@/shared/types'
import { AgentIcon } from '@/features/agents/components/AgentIcon'
import { Menu } from '@/components/Menu'
import { FIELD, Modal } from '@/components/ui'
import { fmtDelta, fmtTokens, resumeArgs, severity, short } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useResizeHeight } from '@/lib/useResizeHeight'
import { basename } from '@/lib/paths'
import { useStore } from '@/store'
import { useChat, useChat2 } from '@/store/chat'

const REFRESH_MS = 30_000
const WINDOW_MS = 5 * 3_600_000
const BAR: Record<string, string> = { danger: 'bg-danger', warn: 'bg-warn', accent: 'bg-accent' }

function Bar({ value, tone = 'accent' }: { value: number; tone?: string }) {
  return (
    <div className="h-[6px] overflow-hidden rounded-full bg-ov/[0.07]">
      <div className={clsx('h-full rounded-full transition-all duration-500', BAR[tone])} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  )
}

function Limit({ limit, extra, now }: { limit: LimitInfo; extra?: string; now: number }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[12px]"><span>{limit.label}</span><span className="tabular-nums">{limit.percent.toFixed(0)}%</span></div>
      <Bar value={limit.percent / 100} tone={severity(limit.percent)} />
      <div className="text-[10px] text-muted">{t('us.resets', { delta: fmtDelta(limit.resetsAt - now) })}{extra ? ` · ${extra}` : ''}</div>
    </div>
  )
}

function Card({ u, now, email }: { u: AgentUsage; now: number; email?: string | null }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const w = u.window
  /** Tokens abreviados, o créditos con dos decimales (Kiro). */
  const amount = (n: number): string => (u.unit === 'credits' ? t('us.credits', { n: n.toLocaleString(lang, { maximumFractionDigits: 2 }) }) : fmtTokens(n))
  return (
    <div className="flex flex-col gap-1.5 border-t border-line px-1.5 pb-1 pt-2 first:border-t-0 first:pt-0.5 last:pb-0">
      <div className="flex items-center gap-2 text-[12px]"><AgentIcon name={u.name} command={u.command} size={16} /><span className="shrink-0 text-muted">{u.name}</span>{email && <span className="ml-auto min-w-0 truncate">{email}</span>}</div>
      {u.limits.length > 0 ? (
        <>
          {u.limits.map((l, i) => <Limit key={l.label} limit={l} now={now} extra={i === 0 && w ? t('us.tokens', { n: fmtTokens(w.tokens) }) : undefined} />)}
          {u.limitsAge > 600 && <div className="text-[10px] text-muted">{t('us.updatedAgo', { delta: fmtDelta(u.limitsAge * 1000) })}</div>}
        </>
      ) : w ? (
        <>
          <div className="text-[20px] font-semibold text-accent">{t('us.tokens', { n: fmtTokens(w.tokens) })}</div>
          <div className="-mt-1.5 text-[11px] text-muted">{t('us.currentSession')}</div>
          <Bar value={(now - w.start) / WINDOW_MS} />
          <div className="text-[11px]">{t('us.resetsAt', { delta: fmtDelta(w.end - now), time: new Date(w.end).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })}</div>
        </>
      ) : u.note ? (
        <div className="text-[11px] text-muted">{u.note}</div>
      ) : (
        <div className="text-[11px] text-muted">{t('us.noSession')}</div>
      )}
      {u.limitsError && u.limits.length === 0 && <div className="text-[10px] text-muted">{u.limitsError}</div>}
      {u.total > 0 && u.note && (w || u.limits.length > 0) && (
        <div className="border-t border-line pt-2 text-[10px] text-muted">{u.note}</div>
      )}
    </div>
  )
}

/**
 * Sección plegable (como las de MCP): título con flecha y contador, contenido con scroll propio y altura ajustable (`resize`), o que ocupa
 * el espacio libre (`fill`). `footer` queda fijo bajo el scroll: no se desplaza con la lista. La vista no scrollea: lo hace cada sección.
 */
function Section({ title, id, detail, count, folded, onToggle, fill = false, resize = false, footer, children }: {
  title: string; id: string; detail?: string; count?: number; folded: boolean; onToggle: (id: string) => void
  fill?: boolean; resize?: boolean; footer?: React.ReactNode; children: React.ReactNode
}) {
  const t = useT()
  const size = useResizeHeight(`tutti.usage.${id}.height`)
  return (
    <>
    <section className={clsx('flex min-h-0 flex-col gap-2', fill && !folded ? 'min-h-32 flex-1' : 'shrink')}>
      <button onClick={() => onToggle(id)} aria-expanded={!folded} className="flex shrink-0 items-center gap-1 rounded-md px-0.5 py-1 text-left transition-colors hover:bg-accent-bg">
        {folded ? <MdKeyboardArrowRight size={14} className="text-muted" /> : <MdKeyboardArrowDown size={14} className="text-muted" />}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</span>
        {count !== undefined && count > 0 && <span className="rounded-full bg-accent/25 px-2 py-px text-[10px] font-semibold text-accent">{count}</span>}
        <span className="ml-1 min-w-0 flex-1 truncate text-[10px] text-muted">{detail}</span>
      </button>
      {!folded && (
        <>
          <div ref={size.body} style={!fill && size.height ? { height: size.height } : undefined} className={clsx('sect-scroll flex min-h-0 flex-col gap-2 overflow-y-auto', fill ? 'flex-1' : !size.height && 'max-h-96')}>{children}</div>
          {footer && <div className="shrink-0">{footer}</div>}
        </>
      )}
    </section>
    {!folded && resize && !fill && (
      <div onPointerDown={size.start} onDoubleClick={size.reset} title={t('st.resize')} role="separator" aria-orientation="horizontal"
        className="group shrink-0 cursor-row-resize touch-none py-1"><div className="h-px bg-line transition-colors group-hover:bg-accent" /></div>
    )}
    </>
  )
}

/** Consumo de tokens, reinicio e historial de cada agente instalado. */
export function UsageView() {
  const t = useT()
  const project = useStore((s) => s.project)
  const agents = useStore((s) => s.agents)
  const set = useStore((s) => s.set)
  const openAgent = useStore((s) => s.openAgent)
  const toast = useStore((s) => s.toast)
  const chatSession = useChat((c) => c.session)
  const chatSession2 = useChat2((c) => c.session)
  const panes = useStore((s) => s.panes)
  /** ¿Se está usando ahora? Es la conversación abierta en uno de los chats, o una retomada en un panel de agente. */
  const inUse = (s: SessionInfo): boolean => chatSession === s.id || chatSession2 === s.id || panes.some((p) => p.command === s.command && (p.args ?? []).includes(s.id))
  const [data, setData] = useState<UsageData | null>(null)
  const [accounts, setAccounts] = useState<{ claude: string | null; codex: string | null } | null>(null)          // el correo de cada cuenta con sesión iniciada
  const [names, setNames] = useState<Record<string, string>>({})
  const [pinned, setPinned] = useState<string[]>([])          // las conversaciones fijadas (`agente:id`): van arriba
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const [menu, setMenu] = useState<{ session: SessionInfo; anchor: DOMRect } | null>(null)
  const [renaming, setRenaming] = useState<SessionInfo | null>(null)
  const [deleting, setDeleting] = useState<SessionInfo | null>(null)
  const [clearing, setClearing] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [choosing, setChoosing] = useState<SessionInfo | null>(null)          // una conversación de Claude: ¿en la terminal o en el chat?

  const load = useCallback(async (fetchLimits: boolean) => {
    const [usage, saved] = await Promise.all([window.api.usage.collect(project, fetchLimits), window.api.usage.names()])
    setData(usage); setNames(saved); setNow(Date.now())
  }, [project])

  useEffect(() => { void window.api.accounts.get().then(setAccounts).catch(() => undefined) }, [])
  useEffect(() => { void window.api.agents.detect().then((a) => set({ agents: a })); void window.api.settings.get('pinned_sessions').then((p) => setPinned(Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [])); void window.api.settings.get('collapsed').then((c) => setFolded((c as Record<string, boolean>) ?? {})) }, [set])
  // al abrir la pestaña se consulta a Anthropic una vez (los límites reales); después solo se relee lo local
  useEffect(() => { void load(true); const timer = setInterval(() => void load(false), REFRESH_MS); return () => clearInterval(timer) }, [load])

  const toggle = (id: string): void => { const next = { ...folded, [id]: !folded[id] }; setFolded(next); void window.api.settings.set('collapsed', next) }
  const keyOf = (s: SessionInfo): string => `${s.command}:${s.id}`
  const togglePin = (s: SessionInfo): void => { const next = pinned.includes(keyOf(s)) ? pinned.filter((k) => k !== keyOf(s)) : [...pinned, keyOf(s)]; setPinned(next); void window.api.settings.set('pinned_sessions', next) }
  const title = (s: SessionInfo): string => names[`${s.command}:${s.id}`] || s.title

  /** En el chat: se carga lo que se dijo y los próximos mensajes continúan esa conversación. */
  const resumeInChat = (s: SessionInfo): void => {
    if (useChat.getState().running) { toast(t('us.chatBusy'), 'error'); return }
    void window.api.chat.history(s.id, s.cwd || undefined).then((history) => {
      useChat.getState().load(s.id, project, history)
      useStore.getState().setEditorFull(true)          // el chat solo está en «Modo agentes»
      set({ chatOpen: true })
    }).catch(() => toast(t('us.cannotResume'), 'error'))
  }
  const resume = (s: SessionInfo): void => {
    if (s.command === 'claude' && project) { setChoosing(s); return }
    resumeCli(s)
  }
  const resumeCli = (s: SessionInfo): void => {
    const args = resumeArgs(s.command, s.id)
    const agent = agents.find((a) => a.command === s.command)
    if (!args || !agent) { toast(t('us.cannotResume'), 'error'); return }
    void openAgent(agent, args, { cwd: s.cwd || undefined, title: `${s.agent} · ${title(s)}` })
  }

  if (!data) return <p className="px-3 text-[11px] text-muted">{t('us.reading')}</p>
  if (!data.agents.length) return <p className="px-3 text-[12px] text-muted">{t('us.noAgents')}</p>

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden px-2 pb-3">
      <Section title={t('us.usage')} id="usage" folded={!!folded.usage} onToggle={toggle} fill={!!folded.history} resize>          {/* con el historial plegado, el consumo ocupa todo el espacio libre */}
        {[...data.agents].filter((u) => u.limits.length > 0 || u.window).sort((a, b) => a.name.localeCompare(b.name)).map((u) => <Card key={u.command} u={u} now={now} email={u.command === 'claude' ? accounts?.claude : u.command === 'codex' ? accounts?.codex : null} />)}
      </Section>
      <Section title={t('us.history')} id="history" detail={project ? basename(project) : ''} count={project ? data.history.length : undefined} folded={!!folded.history} onToggle={toggle} fill
        footer={project && data.history.some((x) => !pinned.includes(keyOf(x))) ? (
          <button onClick={() => setClearing(true)} title={t('us.clearTip')}
            className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[12px] text-muted transition-colors hover:border-danger/50 hover:bg-danger/10 hover:text-danger">
            <MdDeleteSweep size={15} /> {t('us.clear')}
          </button>
        ) : undefined}>
        {!project && <p className="px-1 text-[11px] text-muted">{t('us.openProject')}</p>}
        {project && data.history.length === 0 && <p className="px-1 text-[11px] text-muted">{t('us.noSessions')}</p>}
        <ul className="flex flex-col divide-y divide-line/60">
          {[...data.history.filter((x, i) => i < 100 || pinned.includes(keyOf(x)))].sort((a, b) => Number(pinned.includes(keyOf(b))) - Number(pinned.includes(keyOf(a)))).map((s) => {          // las fijadas primero; el resto conserva su orden
            const can = resumeArgs(s.command, s.id) !== null
            return (
              <li key={`${s.command}:${s.id}`} className="group flex items-center rounded transition-colors hover:bg-accent-bg">
                <button disabled={!can} onClick={() => resume(s)} title={`${s.agent} · ${s.project} · ${fmtTokens(s.tokens)}${can ? ` — ${t('us.resumeTip')}` : ''}`} className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left">
                  {inUse(s) && <span title={t('us.inUse')} className="size-1.5 shrink-0 rounded-full bg-accent" />}
                  {pinned.includes(keyOf(s)) && <MdPushPin size={12} className="shrink-0 text-accent" />}
                  <span className="min-w-0 flex-1 truncate text-[13px]">{title(s)}</span>
                  <span className={clsx('shrink-0 text-[11px] text-muted group-hover:hidden', menu?.session === s && 'hidden')}>{short(s.end, now, t('time.now'))}</span>
                </button>
                <button title={t('us.moreActions')} onClick={(e) => setMenu({ session: s, anchor: e.currentTarget.getBoundingClientRect() })}
                  className={clsx('mr-1 size-5 shrink-0 place-items-center rounded-md text-muted hover:bg-ov/10 hover:text-text',
                    menu?.session === s ? 'grid bg-ov/10 text-text' : 'hidden group-hover:grid')}>
                  <MdMoreHoriz size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      </Section>

      {menu && (
        <Menu anchor={menu.anchor} onClose={() => setMenu(null)} items={[
          { label: t('us.resume'), icon: <MdPlayArrow size={16} />, hidden: !resumeArgs(menu.session.command, menu.session.id), onClick: () => resume(menu.session) },
          { label: t(pinned.includes(keyOf(menu.session)) ? 'us.unpin' : 'us.pin'), icon: pinned.includes(keyOf(menu.session)) ? <MdOutlinePushPin size={15} /> : <MdPushPin size={15} />, onClick: () => togglePin(menu.session) },
          { label: t('us.renameItem'), icon: <MdEdit size={15} />, onClick: () => setRenaming(menu.session) },
          { label: t('us.deleteItem'), separator: true, hidden: pinned.includes(keyOf(menu.session)), icon: <MdDeleteOutline size={16} />, danger: true, onClick: () => setDeleting(menu.session) }
        ]} />
      )}
      {choosing && (
        <Modal onClose={() => setChoosing(null)} width={380} title={t('us.openWhere')}>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <p className="truncate text-[12px] text-muted">{title(choosing)}</p>
            <button autoFocus onClick={() => { const s = choosing; setChoosing(null); resumeInChat(s) }} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{t('us.openChat')}</button>
            <button onClick={() => { const s = choosing; setChoosing(null); resumeCli(s) }} className="rounded-lg border border-line px-4 py-1.5 text-[12px] transition-colors hover:border-accent hover:bg-accent-bg">{t('us.openCli')}</button>
          </div>
        </Modal>
      )}
      {renaming && <RenameDialog session={renaming} current={title(renaming)} onClose={() => setRenaming(null)} onSaved={() => void load(false)} />}
      {clearing && (
        <Modal onClose={() => setClearing(false)} width={420} title={t('us.clearTitle')}>
          <div className="px-4 pb-4">
            <p className="text-[12px] leading-relaxed text-muted">{t('us.clearBody', { n: data.history.filter((x) => !pinned.includes(keyOf(x))).length })}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setClearing(false)} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
              <button onClick={() => {
                setClearing(false)
                void (async () => {
                  let failed = 0
                  for (const s of data.history.filter((x) => !pinned.includes(keyOf(x)))) { const r = await window.api.usage.remove(s); if (!r.ok) failed++ }
                  if (failed) toast(t('us.clearFailed', { n: failed }), 'error')
                  void load(false)
                })()
              }} className="rounded-lg bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/25">{t('us.deleteAll')}</button>
            </div>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal onClose={() => setDeleting(null)} width={400} title={t('us.deleteTitle')}>
          <div className="px-4 pb-4">
            <p className="text-[12px] leading-relaxed text-muted">{t('us.deleteBody', { title: title(deleting), agent: deleting.agent })}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
              <button onClick={() => { const s = deleting; setDeleting(null); void window.api.usage.remove(s).then((r) => { if (!r.ok) toast(t('us.deleteFailed', { message: r.message }), 'error'); void load(false) }) }}
                className="rounded-lg bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/25">{t('us.delete')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function RenameDialog({ session, current, onClose, onSaved }: { session: SessionInfo; current: string; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [value, setValue] = useState(current)
  const save = (): void => { void window.api.usage.rename(session, value).then(() => { onSaved(); onClose() }) }
  return (
    <Modal onClose={onClose} width={420} title={t('us.renameTitle')}>
      <div className="px-4 pb-4">
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }} spellCheck={false}
          className={FIELD} />
        <p className="mt-2 text-[10px] text-muted">{t('us.renameNote')}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button onClick={save} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-colors hover:brightness-110">{t('us.save')}</button>
        </div>
      </div>
    </Modal>
  )
}
