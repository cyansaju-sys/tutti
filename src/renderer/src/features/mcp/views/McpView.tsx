import { clsx } from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MdAdd, MdCheckCircle, MdChevronRight, MdCloudQueue, MdContentCopy, MdDeleteOutline, MdEdit, MdErrorOutline, MdPlayArrow, MdPower, MdPowerSettingsNew, MdSettings, MdSync, MdTerminal, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import type { McpAgent, McpProbe, McpScope, McpServer, McpSpec, McpTransport, SyncScope, SyncState } from '@shared/types'
import { FIELD, Modal } from '@/shared/components/ui'
import { AGENT_NAMES, shortName, agentsMissing, editTargets, isAppServer, removeTargets, isSecret, mask, parsePairs, prefillFromServer, SCOPE_KEYS, specFromServer, splitArgs, type Prefill } from '@/features/mcp/lib/mcp'
import { useT } from '@/shared/lib/i18n'
import { useResizeHeight } from '@/shared/lib/useResizeHeight'
import { useStore } from '@/shared/store'

/** Iniciales sobre un color propio de cada servidor (el registro no trae iconos). */
export function Avatar({ name }: { name: string }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = hash % 360
  const letters = shortName(name).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?'
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg text-[12px] font-semibold text-white" style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 52%), hsl(${(hue + 30) % 360} 55% 38%))` }}>
      {letters}
    </span>
  )
}

const SUPPORTED: McpAgent[] = ['claude', 'opencode', 'gemini', 'codex', 'agy', 'qwen', 'cursor']
/** Comando con el que se detecta el agente, si no es su propio nombre. */
const COMMAND: Partial<Record<McpAgent, string>> = { cursor: 'cursor-agent' }
const REFRESH_MS = 5000

/**
 * Sección plegable: el título con una flecha; se recuerda si estaba cerrada. Su contenido tiene su propio scroll: altura máxima fija o, con `fill`, todo el espacio libre de la vista (la última sección).
 * Con `forceOpen` siempre se ve desplegada. Con `resize`, un tirador bajo el contenido deja arrastrar su altura (doble clic: vuelve a la automática); se recuerda.
 */
function Fold({ id, title, count, fill = false, resize = false, forceOpen = false, children }: { id: string; title: string; count?: number; fill?: boolean; resize?: boolean; forceOpen?: boolean; children: React.ReactNode }) {
  const key = `tutti.mcp.${id}.collapsed`
  const [stored, setCollapsed] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  const collapsed = stored && !forceOpen                     // con forceOpen (p. ej. al buscar) se ve aunque la hayas plegado
  const toggle = (): void => forceOpen ? undefined : setCollapsed((c) => { try { localStorage.setItem(key, c ? '0' : '1') } catch { /* sin almacenamiento */ } return !c })
  const t = useT()
  const size = useResizeHeight(`tutti.mcp.${id}.height`)
  return (
    <>
    <section className={clsx('border-t border-line pb-1 first:border-t-0 [.rh+&]:border-t-0', fill && !collapsed && 'flex min-h-40 flex-1 flex-col')}>
      <button onClick={toggle} aria-expanded={!collapsed} className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-text transition-colors hover:text-accent">
        <MdChevronRight size={14} className={clsx('shrink-0 transition-transform', !collapsed && 'rotate-90')} />
        <h4 className="truncate text-[12px] font-semibold">{title}</h4>
        {count !== undefined && <span className="ml-1 rounded-full bg-accent/25 px-2 py-px text-[10px] font-semibold text-accent">{count}</span>}
      </button>
      {!collapsed && <div ref={size.body} style={size.height ? { height: size.height } : undefined} className={clsx('sect-scroll overflow-y-auto', fill ? 'min-h-0 flex-1' : !size.height && 'max-h-60')}>{children}</div>}
    </section>
    {!collapsed && resize && (
      <div onPointerDown={size.start} onDoubleClick={size.reset} title={t('st.resize')} role="separator" aria-orientation="horizontal"
        className="rh group cursor-row-resize touch-none py-1"><div className="h-px bg-line transition-colors group-hover:bg-accent" /></div>
    )}
    </>
  )
}

const SYNC_KEYS = { ok: 'mcp.syncOk', missing: 'mcp.syncMissing', differs: 'mcp.syncDiffers', disabled: 'mcp.syncDisabled', unsupported: 'mcp.syncUnsupported', launch: 'mcp.syncLaunch' } as const

type SyncAgents = SyncState['servers'][number]['agents']
const needsWork = (state: SyncAgents[number]['state']): boolean => state !== 'ok' && state !== 'launch'

/** Cómo está cada servidor frente a la fuente (Claude Code: `.mcp.json` o sus MCP de usuario), en el proyecto y en global. */
function useSync(project: string | null): { states: Array<{ scope: SyncScope; state: SyncState }>; load: () => Promise<void> } {
  const [states, setStates] = useState<Array<{ scope: SyncScope; state: SyncState }>>([])
  const load = useCallback(async () => {
    const scopes: SyncScope[] = project ? ['project', 'global'] : ['global']
    const next = (await Promise.all(scopes.map(async (scope) => ({ scope, state: await window.api.mcp.sync.state(project, scope) })))).filter((x) => x.state.available)
    setStates((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [project])
  useEffect(() => { void load(); const i = setInterval(() => void load(), REFRESH_MS); return () => clearInterval(i) }, [load])
  return { states, load }
}

const syncButton = 'rounded-md bg-ov/[0.05] px-2 py-0.5 transition-colors hover:bg-accent-bg disabled:opacity-50'
const wideButton = 'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-1 text-[12px] text-muted transition-colors enabled:hover:border-accent enabled:hover:bg-accent-bg enabled:hover:text-accent disabled:opacity-50'

/** Lo que le falta a un servidor en otros agentes, bajo su tarjeta; un desfase se resuelve ahí mismo. */
function SyncNotes({ pending, busy, onResolve }: {
  pending: Array<{ scope: SyncScope; agents: SyncAgents }>; busy: boolean; onResolve: (scope: SyncScope, agent: McpAgent, use: 'source' | 'agent') => void
}) {
  const t = useT()
  return (
    <div className="flex flex-col gap-1 pb-1.5 pl-9 pr-2 text-[11px]">
      {pending.map(({ scope, agents }) => (
        <div key={scope}>
          <span className="text-warn">{pending.length > 1 && `${t(SCOPE_KEYS[scope])}: `}{agents.filter((a) => needsWork(a.state)).map((a) => `${AGENT_NAMES[a.agent]}: ${t(SYNC_KEYS[a.state])}`).join(' · ')}</span>
          {agents.filter((a) => a.state === 'differs').map((a) => (
            <span key={a.agent} className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-muted">{AGENT_NAMES[a.agent]}:</span>
              <button disabled={busy} onClick={() => onResolve(scope, a.agent, 'source')} className={syncButton}>{t('mcp.syncUseSource')}</button>
              <button disabled={busy} onClick={() => onResolve(scope, a.agent, 'agent')} className={syncButton}>{t('mcp.syncUseAgent')}</button>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-medium text-accent">{children}</span>
)

/** Los instalados llevan su pliegue «Instalados»; incrustados en la pestaña Tutti (compact) la sección ya lo dice: van sin título, con la misma altura máxima y scroll que la tienda. */
function InstalledWrap({ compact, count, children }: { compact: boolean; count: number; children: React.ReactNode }) {
  const t = useT()
  return compact ? <div className="sect-scroll max-h-60 overflow-y-auto">{children}</div> : <Fold id="installed" title={t('st.installed')} count={count} resize>{children}</Fold>
}

/**
 * Servidores MCP de cada agente instalado, con + para añadir uno y papelera para quitarlo.
 * `compact`: sin título y con sangría, para incrustarla como sección de otra vista; `addSignal` abre el diálogo de añadir al cambiar.
 */
export function McpView({ compact = false, addSignal = 0 }: { compact?: boolean; addSignal?: number }) {
  const t = useT()
  const project = useStore((s) => s.project)
  const agents = useStore((s) => s.agents)
  const set = useStore((s) => s.set)
  const [servers, setServers] = useState<McpServer[] | null>(null)
  const [details, setDetails] = useState<string | null>(null)          // nombre (en minúsculas) del servidor abierto
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<McpServer[] | null>(null)      // grupo que se está editando
  const [removing, setRemoving] = useState<McpServer[] | null>(null)    // grupo que se va a quitar (pide confirmación)
  const [prefill, setPrefill] = useState<Prefill | null>(null)          // el diálogo de añadir con los datos rellenos

  const installed = useMemo(() => SUPPORTED.filter((a) => agents.some((x) => x.command === (COMMAND[a] ?? a))), [agents])
  const refresh = useCallback(async () => {
    const next = await window.api.mcp.list(project)
    setServers((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [project])

  useEffect(() => { if (addSignal > 0 && installed.length) setAdding(true) }, [addSignal])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void window.api.agents.detect().then((a) => set({ agents: a })) }, [set])
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), REFRESH_MS); return () => clearInterval(t) }, [refresh])

  const visible = (servers ?? []).filter((s) => installed.includes(s.agent) && !isAppServer(s))      // el de la app no se gestiona aquí
  /** Un servidor por nombre, con todos los agentes (y alcances) donde está. */
  const groups = useMemo(() => {
    const map = new Map<string, McpServer[]>()
    for (const sv of visible) map.set(sv.name.toLowerCase(), [...(map.get(sv.name.toLowerCase()) ?? []), sv])
    return [...map.values()].sort((a, b) => a[0].name.localeCompare(b[0].name))
  }, [visible])
  const open = details ? groups.find((g) => g[0].name.toLowerCase() === details) : undefined


  // sincronizar con la fuente: lo pendiente va en la tarjeta de cada servidor y las acciones, al final de la lista
  const toast = useStore((s) => s.toast)
  const sync = useSync(project)
  const [busy, setBusy] = useState(false)
  const pending = useMemo(() => {
    const map = new Map<string, Array<{ scope: SyncScope; agents: SyncAgents }>>()
    for (const { scope, state } of sync.states) {
      for (const sv of state.servers) if (sv.agents.some((a) => needsWork(a.state))) map.set(sv.name.toLowerCase(), [...(map.get(sv.name.toLowerCase()) ?? []), { scope, agents: sv.agents }])
    }
    return map
  }, [sync.states])
  const run = async (actions: Array<() => Promise<{ ok: boolean; message: string }>>): Promise<void> => {
    setBusy(true)
    const results: Array<{ ok: boolean; message: string }> = []
    for (const action of actions) results.push(await action())
    setBusy(false)
    const failed = results.find((r) => !r.ok)
    if (results.length) toast((failed ?? results[results.length - 1]).message, failed ? 'error' : 'ok')
    void sync.load(); void refresh()
  }
  /** Si el servidor está en `.mcp.json`: cómo lo recibe cada agente (el mismo estado que la sincronización). */
  const followOf = (g: McpServer[]): Follow | undefined => {
    const source = g.find((x) => x.agent === 'claude' && x.scope === 'shared')
    const agents = source && sync.states.find((x) => x.scope === 'project')?.state.servers.find((sv) => sv.name.toLowerCase() === source.name.toLowerCase())?.agents
    return source && agents ? { source, agents } : undefined
  }
  const remove = async (group: McpServer[]): Promise<void> => {
    setRemoving(null)
    // primero la fuente: al quitarla de .mcp.json, Antigravity y Codex la pierden solos
    const targets = removeTargets(group).sort((a, b) => Number(b.agent === 'claude' && b.scope === 'shared') - Number(a.agent === 'claude' && a.scope === 'shared'))
    await run(targets.map((x) => async () => {
      const res = await window.api.mcp.remove(x, project)
      return res.ok ? { ok: true, message: t('mcp.removed', { name: x.name }) } : { ok: false, message: t('mcp.removeFailed', { message: res.message }) }
    }))
  }
  const missingIn = sync.states.filter(({ scope }) => [...pending.values()].some((p) => p.some((x) => x.scope === scope && x.agents.some((a) => a.state === 'missing'))))
  const local = sync.states.find((x) => x.scope === 'project')?.state.local ?? 0
  const pullFrom = sync.states.filter(({ scope, state }) => state.extras > 0 && !(scope === 'project' && local > 0))
  const pullCount = pullFrom.reduce((n, x) => n + x.state.extras, 0)
  const syncActions = sync.states.length > 0 && (
    <div className="flex flex-col gap-1 px-1 pb-1 pt-1">
      <button disabled={busy || !missingIn.length} onClick={() => void run(missingIn.map(({ scope }) => () => window.api.mcp.sync.apply(project, scope)))} className={wideButton}>{t('mcp.syncApply')}</button>
      {local > 0 && <button disabled={busy} onClick={() => void run([() => window.api.mcp.sync.standardize(project!)])} className={wideButton}>{t('mcp.syncStandardize', { count: String(local) })}</button>}
      {pullCount > 0 && <button disabled={busy} onClick={() => void run(pullFrom.map(({ scope }) => () => window.api.mcp.sync.pull(project, scope)))} className={wideButton}>{t('mcp.syncPull', { count: String(pullCount) })}</button>}
    </div>
  )

  return (
    <div className={clsx('flex flex-col', compact ? 'pl-3' : 'h-full px-2')}>
      <div className={clsx(!compact && 'flex min-h-0 flex-1 flex-col overflow-y-auto pb-2')}>
        {servers === null && <p className="px-2 text-[11px] text-muted">{t('mcp.reading')}</p>}
        {servers && installed.length === 0 && <p className="px-2 text-[11px] text-muted">{t('mcp.noneSupported')}</p>}
        {servers && installed.length > 0 && visible.length === 0 && (compact
          ? <div className="px-1"><button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-1 text-[12px] text-muted transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent"><MdAdd size={15} /> {t('mcp.addTip')}</button></div>
          : <p className="px-2 text-[11px] text-muted">{t('mcp.empty')}</p>)}
        {groups.length > 0 && <InstalledWrap compact={compact} count={groups.length}>
        {groups.map((g) => {
          const first = g[0]
          const agentNames = [...new Set(g.map((x) => AGENT_NAMES[x.agent]))]
          const todo = pending.get(first.name.toLowerCase())
          return (
            <div key={first.name.toLowerCase()} className="rounded-lg transition-colors hover:bg-accent-bg">
            <div className={clsx('group flex items-center gap-1', g.every((x) => x.disabled) && 'opacity-55')}>
              <button onClick={() => setDetails(first.name.toLowerCase())} title={t('mcp.details')} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left">
                {compact ? <MdPower size={15} className="shrink-0 text-accent" aria-hidden /> : <Avatar name={first.name} />}          {/* en la pestaña Tutti, un enchufe en lugar de las iniciales */}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-[12px] font-semibold">{first.name}</span>
                    {first.kind === 'remote' ? <MdCloudQueue size={13} className="shrink-0 text-muted" /> : <MdTerminal size={13} className="shrink-0 text-muted" />}
                  </span>
                  <span className="block truncate text-[11px] text-muted">{g.every((x) => x.disabled) && `${t('mcp.off')} · `}{t(SCOPE_KEYS[first.scope])} · {agentNames.join(', ')}</span>
                </span>
              </button>
              <button title={t('mcp.remove')} onClick={() => setRemoving(g)}
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted opacity-0 transition-all hover:bg-danger/15 hover:text-danger group-hover:opacity-100">
                <MdDeleteOutline size={16} />
              </button>
              <button title={t('mcp.details')} onClick={() => setDetails(first.name.toLowerCase())}
                className="mr-1 grid size-6 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-ov/[0.08] hover:text-text">
                <MdSettings size={16} />
              </button>
            </div>
            {todo && <SyncNotes pending={todo} busy={busy} onResolve={(scope, agent, use) => void run([() => window.api.mcp.sync.resolve(project, scope, first.name, agent, use)])} />}
            </div>
          )
        })}
        {syncActions}
        </InstalledWrap>}
      </div>

      {prefill && <AddDialog installed={installed} project={project} prefill={prefill} onClose={() => setPrefill(null)} onDone={() => void refresh()} />}
      {open && <Details group={open} installed={installed} project={project} follow={followOf(open)} onClose={() => setDetails(null)} onChanged={() => { void sync.load(); void refresh() }} onEdit={(g) => { setDetails(null); setEditing(g) }} onRemove={(g) => { setDetails(null); setRemoving(g) }} />}
      {removing && (
        <Modal onClose={() => setRemoving(null)} width={400} title={t('mcp.removeTitle')}>
          <div className="px-4 pb-4">
            <p className="text-[12px] leading-relaxed text-muted">{t('mcp.removeMany', { name: removing[0].name, agents: [...new Set(removeTargets(removing).map((x) => AGENT_NAMES[x.agent]))].join(', ') })}</p>
            {removing.some((x) => x.agent === 'claude' && x.scope === 'shared') && <p className="pt-1.5 text-[12px] leading-relaxed text-muted">{t('mcp.removeShared')}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRemoving(null)} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
              <button onClick={() => void remove(removing)} className="rounded-lg bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/25">{t('mcp.remove')}</button>
            </div>
          </div>
        </Modal>
      )}
      {adding && <AddDialog installed={installed} project={project} onClose={() => setAdding(false)} onDone={() => void refresh()} />}
      {editing && <AddDialog installed={installed} project={project} editing={editing} prefill={prefillFromServer(editing.find((x) => !x.disabled) ?? editing[0])} onClose={() => setEditing(null)} onDone={() => void refresh()} />}
    </div>
  )
}

/** Un servidor de `.mcp.json` (la fuente) y cómo lo recibe cada agente instalado. */
type Follow = { source: McpServer; agents: SyncAgents }
/** Agentes que siguen `.mcp.json` solos (Tutti les refleja cada cambio). */
const MIRRORS: McpAgent[] = ['agy', 'codex']
/** Un agente en «Aplicado en»: ficha con su estado por color (el detalle, al pasar el ratón) y sus acciones. */
function Chip({ name, tone, tip, children }: { name: string; tone: 'ok' | 'warn' | 'off'; tip: string; children?: React.ReactNode }) {
  return (
    <span title={tip} className={clsx('flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[12px]', tone === 'warn' ? 'bg-warn/15' : 'bg-ov/[0.05]', tone === 'off' && 'opacity-60')}>
      {tone === 'warn' ? <MdErrorOutline size={14} className="shrink-0 text-warn" /> : <MdCheckCircle size={14} className={clsx('shrink-0', tone === 'ok' ? 'text-accent' : 'text-muted')} />}
      <span className="font-medium">{name}</span>
      {children}
    </span>
  )
}
const ChipButton = ({ title, disabled, onClick, children }: { title: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button title={title} disabled={disabled} onClick={onClick} className="grid size-5 place-items-center rounded-full text-muted transition-colors hover:bg-ov/[0.1] hover:text-accent disabled:opacity-50">{children}</button>
)
const VIA_KEYS = { missing: 'mcp.viaMissing', differs: 'mcp.viaDiffers', disabled: 'mcp.viaDisabled', unsupported: 'mcp.syncUnsupported', launch: 'mcp.viaLaunch' } as const

function Details({ group, installed, project, follow, onClose, onChanged, onEdit, onRemove }: {
  group: McpServer[]; installed: McpAgent[]; project: string | null; follow?: Follow; onClose: () => void; onChanged: () => void; onEdit: (group: McpServer[]) => void; onRemove: (group: McpServer[]) => void
}) {
  const t = useT()
  const server = group[0]
  const all = group
  const toast = useStore((s) => s.toast)
  const [reveal, setReveal] = useState(false)
  const [probe, setProbe] = useState<McpProbe | 'running' | null>(null)
  const [busy, setBusy] = useState(false)
  const cfg = server.config as Record<string, unknown>
  const headers = (cfg.headers as Record<string, string>) ?? {}
  const env = { ...((cfg.environment as Record<string, string>) ?? {}), ...((cfg.env as Record<string, string>) ?? {}) }
  const hasSecrets = [...Object.keys(headers), ...Object.keys(env)].some(isSecret)
  const missing = agentsMissing(server, all, SUPPORTED).filter((a) => installed.includes(a as McpAgent)) as McpAgent[]
  const copy = async (text: string): Promise<void> => { await navigator.clipboard.writeText(text) }

  const runProbe = async (): Promise<void> => {
    setProbe('running')
    setProbe(await window.api.mcp.probe(group.find((x) => !x.disabled) ?? server, project))
  }
  const toggle = async (x: McpServer): Promise<void> => {
    setBusy(true)
    const res = await (x.disabled ? window.api.mcp.enable(x, project) : window.api.mcp.disable(x, project))
    setBusy(false)
    if (!res.ok) toast(res.message, 'error')
    onChanged()
    if (res.ok) onClose()
  }
  const act = async (action: Promise<{ ok: boolean; message: string }>): Promise<void> => {
    setBusy(true)
    const res = await action
    setBusy(false)
    if (!res.ok) toast(res.message, 'error')
    onChanged()
  }
  // con `follow`, cada agente que lo sigue tiene su fila; las demás copias (locales de Claude, globales) van como siempre
  const followed = follow ? follow.agents.map((a) => ({ ...a, entry: group.find((x) => x.agent === a.agent && x.scope !== 'global') })) : []
  const rest = follow ? group.filter((x) => x !== follow.source && !followed.some((f) => f.entry === x)) : group
  const shown = follow ? [follow.source, ...rest] : group
  const copyTo = async (agent: McpAgent): Promise<void> => {
    const res = await window.api.mcp.add(agent, specFromServer(server), server.scope === 'shared' ? 'project' : server.scope, project)
    if (!res.ok) toast(t('mcp.addFailed', { message: res.message }), 'error')
    onChanged()
    if (res.ok) onClose()
  }
  const Field = ({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) => (
    <div>
      <div className="text-[10px] text-muted">{label}</div>
      <div className="flex items-start gap-1.5">
        <div className="selectable min-w-0 flex-1 whitespace-pre-wrap break-all text-[12px]">{value || '—'}</div>
        {copyable && value && <button title={t('mcp.copyTip')} onClick={() => void copy(value)} className="grid size-6 shrink-0 place-items-center rounded text-muted transition-colors hover:text-accent"><MdContentCopy size={14} /></button>}
      </div>
    </div>
  )
  const pairs = (label: string, map: Record<string, string>): React.ReactNode =>
    Object.keys(map).length ? <Field label={label} value={Object.entries(map).map(([k, v]) => `${k}: ${mask(k, String(v), reveal)}`).join('\n')} /> : null

  return (
    <Modal onClose={onClose} width={500} title={server.name}>
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-4 pb-4">
        <div className="flex flex-wrap gap-1.5">{[...new Set(shown.map((x) => x.scope))].map((sc) => <Tag key={sc}>{t(SCOPE_KEYS[sc])}</Tag>)}<Tag>{server.kind === 'remote' ? t('mcp.remote') : t('mcp.local')}</Tag></div>
        <div className="flex flex-wrap gap-2">
          <button disabled={probe === 'running'} onClick={() => void runProbe()} className="flex items-center gap-1.5 rounded-lg bg-ov/[0.05] px-3 py-1.5 text-[12px] transition-colors hover:bg-accent-bg disabled:opacity-50"><MdPlayArrow size={15} className="text-accent" /> {probe === 'running' ? t('mcp.probing') : t('mcp.probe')}</button>
          <button onClick={() => onEdit(group)} className="flex items-center gap-1.5 rounded-lg bg-ov/[0.05] px-3 py-1.5 text-[12px] transition-colors hover:bg-accent-bg"><MdEdit size={15} className="text-accent" /> {t('mcp.edit')}</button>
          <button onClick={() => onRemove(group)} className="flex items-center gap-1.5 rounded-lg bg-ov/[0.05] px-3 py-1.5 text-[12px] text-danger transition-colors hover:bg-danger/15"><MdDeleteOutline size={15} /> {t('mcp.remove')}</button>
        </div>
        {probe && probe !== 'running' && (
          <div className={clsx('rounded-lg px-3 py-2 text-[11px]', probe.ok ? 'bg-accent/10' : 'bg-danger/10')}>
            <div className={clsx('font-semibold', probe.ok ? 'text-accent' : 'text-danger')}>{probe.message} · {probe.ms} ms</div>
            {probe.tools.length > 0 && <ul className="selectable mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto">{probe.tools.map((x) => <li key={x.name}><span className="font-mono font-semibold">{x.name}</span>{x.description && <span className="text-muted"> · {x.description}</span>}</li>)}</ul>}
          </div>
        )}
        <Field label={server.kind === 'remote' ? t('mcp.url') : t('mcp.command')} value={server.target} copyable />
        {pairs(t('mcp.headers'), headers)}
        {pairs(t('mcp.envVars'), env)}
        <Field label={t('mcp.savedIn')} value={[...new Set(shown.map((x) => x.source).filter(Boolean))].join('\n')} copyable />
        <div>
          <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{t('mcp.appliedTo')}</div>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((x) => (
              <Chip key={`${x.agent}${x.scope}${x.source}`} name={AGENT_NAMES[x.agent]} tone={x.disabled ? 'off' : 'ok'}
                tip={[x.disabled ? t('mcp.off') : '', x === follow?.source ? t('mcp.viaSource') : t(SCOPE_KEYS[x.scope]), x.source].filter(Boolean).join('\n')}>
                <ChipButton disabled={busy} title={t(x.disabled ? 'mcp.enableIn' : 'mcp.disableIn', { agent: AGENT_NAMES[x.agent] })} onClick={() => void toggle(x)}><MdPowerSettingsNew size={13} /></ChipButton>
              </Chip>
            ))}
            {follow && followed.map(({ agent, state, entry }) => (
              <Chip key={agent} name={AGENT_NAMES[agent]} tone={state === 'ok' || state === 'launch' ? 'ok' : state === 'disabled' ? 'off' : 'warn'}
                tip={[t(state === 'ok' ? (MIRRORS.includes(agent) ? 'mcp.viaMirror' : 'mcp.viaCopy') : VIA_KEYS[state]), entry?.source ?? ''].filter(Boolean).join('\n')}>
                {state === 'missing' && <ChipButton disabled={busy} title={t('mcp.addTo', { agent: AGENT_NAMES[agent] })} onClick={() => void act(window.api.mcp.add(agent, specFromServer(follow.source), 'project', project))}><MdAdd size={14} /></ChipButton>}
                {state === 'differs' && <ChipButton disabled={busy} title={t('mcp.syncUseSource')} onClick={() => void act(window.api.mcp.sync.resolve(project, 'project', follow.source.name, agent, 'source'))}><MdSync size={13} /></ChipButton>}
                {entry && <ChipButton disabled={busy} title={t(entry.disabled ? 'mcp.enableIn' : 'mcp.disableIn', { agent: AGENT_NAMES[agent] })} onClick={() => void toggle(entry)}><MdPowerSettingsNew size={13} /></ChipButton>}
              </Chip>
            ))}
          </div>
          {follow && followed.some((f) => f.state !== 'ok' && f.state !== 'launch') && (
            <p className="pt-1.5 text-[11px] text-warn">{followed.filter((f) => f.state !== 'ok' && f.state !== 'launch').map((f) => `${AGENT_NAMES[f.agent]}: ${t(VIA_KEYS[f.state as keyof typeof VIA_KEYS]).toLowerCase()}`).join(' · ')}</p>
          )}
        </div>
        {hasSecrets && (
          <button onClick={() => setReveal(!reveal)} className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted transition-colors hover:bg-accent-bg">
            {reveal ? <MdVisibilityOff size={14} /> : <MdVisibility size={14} />} {reveal ? t('mcp.hideValues') : t('mcp.showValues')}
          </button>
        )}
        {!follow && missing.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-ov/[0.06] pt-3">
            {missing.map((a) => (
              <button key={a} onClick={() => void copyTo(a)} className="flex items-center gap-1.5 rounded-lg bg-ov/[0.05] px-3 py-1.5 text-[12px] transition-colors hover:bg-accent-bg">
                <MdAdd size={15} className="text-accent" /> {t('mcp.copyTo', { agent: AGENT_NAMES[a] })}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

const input = FIELD

function AddDialog({ installed, project, prefill, editing, onClose, onDone }: { installed: McpAgent[]; project: string | null; prefill?: Prefill; editing?: McpServer[]; onClose: () => void; onDone: () => void }) {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const [kind, setKind] = useState<'remote' | 'local'>(prefill?.kind ?? 'remote')
  const [name, setName] = useState(prefill?.name ?? '')
  const [url, setUrl] = useState(prefill?.url ?? '')
  const [transport, setTransport] = useState<McpTransport>(prefill?.transport ?? 'http')
  const [headers, setHeaders] = useState(prefill?.headers ?? '')
  const [command, setCommand] = useState(prefill?.command ?? '')
  const [args, setArgs] = useState(prefill?.args ?? '')
  const [env, setEnv] = useState(prefill?.env ?? '')
  const [targets, setTargets] = useState<McpAgent[]>(installed)
  const [scope, setScope] = useState<McpScope>('global')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const Choice = ({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) => (
    <button disabled={disabled} onClick={onClick} className={clsx('rounded-lg px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40', on ? 'bg-accent/20 text-accent' : 'bg-ov/[0.05] text-muted hover:bg-ov/[0.08]')}>{label}</button>
  )

  const submit = async (): Promise<void> => {
    const spec: McpSpec = kind === 'remote'
      ? { name: name.trim(), kind, url: url.trim(), ...(transport === 'sse' ? { transport } : {}), headers: parsePairs(headers, [': ', ':']) }
      : { name: name.trim(), kind, command: command.trim(), args: splitArgs(args), env: parsePairs(env, ['=']) }
    if (editing) {
      setBusy(true); setError('')
      const failed: string[] = []
      for (const entry of editTargets(editing)) {
        const res = await window.api.mcp.update(entry, spec, project)
        if (!res.ok) failed.push(`${AGENT_NAMES[entry.agent]}: ${res.message}`)
      }
      setBusy(false)
      onDone()
      if (failed.length) setError(failed.join('\n')); else onClose()
      return
    }
    // en el proyecto solo se escribe .mcp.json (la fuente); Antigravity lo sigue solo y el resto con Sincronizar
    const chosen: McpAgent[] = scope === 'project' ? ['claude'] : targets
    if (!chosen.length) { setError(t('mcp.pickOne')); return }
    setBusy(true); setError('')
    const failed: string[] = []
    for (const agent of chosen) {
      const res = await window.api.mcp.add(agent, spec, scope === 'project' ? 'shared' : scope, project)
      if (!res.ok) failed.push(`${AGENT_NAMES[agent]}: ${res.message}`)
    }
    setBusy(false)
    onDone()
    if (failed.length) { setError(failed.join('\n')); return }
    onClose()
  }

  return (
    <Modal onClose={onClose} width={520} title={t(editing ? 'mcp.editTitle' : 'mcp.addTitle')}>
      <div className="flex max-h-[68vh] flex-col gap-3 overflow-y-auto px-4 pb-4">
        <div className="flex gap-2"><Choice on={kind === 'remote'} label={t('mcp.kindRemote')} onClick={() => setKind('remote')} /><Choice on={kind === 'local'} label={t('mcp.kindLocal')} onClick={() => setKind('local')} /></div>
        <input className={input} placeholder={t('mcp.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} disabled={!!editing} spellCheck={false} />
        {kind === 'remote' ? (
          <>
            <div className="flex gap-2">
              <input className={clsx(input, 'flex-1')} placeholder="https://server.example.com/mcp" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
              <Choice on={transport === 'http'} label="HTTP" onClick={() => setTransport('http')} />
              <Choice on={transport === 'sse'} label="SSE" onClick={() => setTransport('sse')} />
            </div>
            <textarea className={clsx(input, 'min-h-[64px] resize-y')} placeholder={t('mcp.headersPlaceholder')} value={headers} onChange={(e) => setHeaders(e.target.value)} spellCheck={false} />
          </>
        ) : (
          <>
            <input className={input} placeholder={t('mcp.cmdPlaceholder')} value={command} onChange={(e) => setCommand(e.target.value)} spellCheck={false} />
            <input className={input} placeholder={t('mcp.argsPlaceholder')} value={args} onChange={(e) => setArgs(e.target.value)} spellCheck={false} />
            <textarea className={clsx(input, 'min-h-[64px] resize-y')} placeholder={t('mcp.envPlaceholder')} value={env} onChange={(e) => setEnv(e.target.value)} spellCheck={false} />
          </>
        )}
        {!editing && <>
        {scope === 'global' && <div>
          <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{t('mcp.agents')}</div>
          <div className="flex flex-wrap gap-2">
            {installed.map((a) => <Choice key={a} on={targets.includes(a)} label={AGENT_NAMES[a]} onClick={() => setTargets((t) => (t.includes(a) ? t.filter((x) => x !== a) : [...t, a]))} />)}
          </div>
        </div>}
        <div>
          <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{t('mcp.where')}</div>
          <div className="flex flex-wrap gap-2">
            <Choice on={scope === 'global'} label={t(SCOPE_KEYS.global)} onClick={() => setScope('global')} />
            <Choice on={scope === 'project'} label={t(SCOPE_KEYS.project)} onClick={() => setScope('project')} disabled={!project} />
          </div>
        </div>
        {scope === 'project' && <p className="text-[11px] leading-snug text-muted">{t('mcp.projectHelp')}</p>}
        </>}
        {editing && <p className="text-[11px] text-muted">{t('mcp.editHelp', { agents: [...new Set(editTargets(editing).map((x) => AGENT_NAMES[x.agent]))].join(', ') })}</p>}
        {error && <pre className="selectable whitespace-pre-wrap text-[11px] leading-snug text-danger">{error}</pre>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button disabled={busy} onClick={() => void submit()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-colors hover:brightness-110 disabled:opacity-50">{busy ? t('mcp.adding') : t(editing ? 'mcp.save' : 'dlg.add')}</button>
        </div>
      </div>
    </Modal>
  )
}
