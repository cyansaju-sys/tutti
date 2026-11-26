import { MdAdd, MdChatBubbleOutline, MdClose, MdCode, MdDragIndicator, MdDeleteOutline, MdEdit, MdOutlinePushPin, MdPlayArrow, MdPushPin, MdOutlineDifference, MdOutlineFolder, MdTerminal, MdVerticalSplit } from 'react-icons/md'
import { useEffect, useRef, useState } from 'react'
import { MdMoreHoriz, MdOutlineChecklist, MdOutlineDescription, MdOutlineDns, MdOutlineExplore, MdOutlineExtension, MdOutlineLightbulb, MdOutlineMap, MdOutlineMenuBook, MdOutlineSettings, MdOutlineSmartToy, MdOutlineWebhook } from 'react-icons/md'
import type { MsgKey } from '@/shared/i18n'
import { useT } from '@/lib/i18n'
import { Menu } from './Menu'
import { settingsMenuItems } from './Sidebar'
import { TuttiView } from '@/features/tutti/views/TuttiView'
import { RolesList } from '@/features/files/views/FilesView'
import { PowersView, type PowersHandle } from '@/features/powers/views/PowersView'
import { Modal, Resizer } from './ui'
import { ErrorBoundary } from './ErrorBoundary'
import type { ChatProjectItems, SessionInfo } from '@/shared/types'
import { short } from '@/lib/format'
import { confirmAsk } from '@/lib/confirm'
import { RenameDialog } from '@/features/usage/views/UsageView'
import { useStore } from '@/store'
import { useChat, useChat2 } from '@/store/chat'

/**
 * «Modo agentes» con el chat solo: la vista de agentes. A la izquierda los chats abiertos y una barrita flotante con los
 * accesos (Cambios y Archivos abren la barra lateral de Tutti). El chat va en el centro.
 */
type Chat = ReturnType<typeof useChat.getState>

/** La configuración del proyecto (las secciones del apartado Tutti), en el orden en que se lista; `count` dice de dónde sale el número. */
const CONFIG: Array<{ id: string; label: MsgKey; icon: typeof MdOutlineWebhook; count?: keyof ChatProjectItems; tab?: 'agents' | 'powers' }> = [
  { id: 'agents', label: 'tab.agents', icon: MdOutlineSmartToy, count: 'roles', tab: 'agents' },          // no es una sección de Tutti: los roles (.tutti/agents)
  { id: 'agentsmd', label: 'tutti.agentsTitle', icon: MdOutlineDescription },
  { id: 'mcp', label: 'tutti.mcp', icon: MdOutlineDns, count: 'mcp' },
  { id: 'powers', label: 'tab.powers', icon: MdOutlineExtension, count: 'powers', tab: 'powers' },          // tampoco es de Tutti: el apartado Powers
  { id: 'skills', label: 'tutti.skills', icon: MdOutlineLightbulb, count: 'skills' },
  { id: 'hooks', label: 'tutti.hooks', icon: MdOutlineWebhook, count: 'hooks' },
  { id: 'steering', label: 'tutti.steering', icon: MdOutlineExplore, count: 'steering' },
  { id: 'specs', label: 'tutti.specs', icon: MdOutlineChecklist, count: 'specs' },
  { id: 'roadmap', label: 'tutti.roadmap', icon: MdOutlineMap },
  { id: 'docs', label: 'tutti.docs', icon: MdOutlineMenuBook, count: 'docs' }
]

const SESSIONS_W_KEY = 'tutti.hub.sessionsWidth'
const SESSIONS_MIN = 160, SESSIONS_MAX = 420

/** Las que se ven en la columna; el resto está en «Ver más» (el diálogo las tiene todas). */
const PINNED = ['agents', 'mcp', 'skills', 'hooks', 'steering', 'specs']

/** La columna de chats: sustituye a las pestañas de arriba. Es una tarjeta aparte, como la barra lateral, a la izquierda del chat. */
export function ChatSessions({ chat, onNew }: { chat: Chat; onNew: (anchor: DOMRect) => void }) {
  const t = useT()
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [dialog, setDialog] = useState<string | null>(null)          // la sección abierta en «Personalizaciones del agente»
  // los contadores (cuántos hooks, skills…): se leen al abrir el proyecto y al cerrar el diálogo (por si se añadió algo)
  const project = useStore((s) => s.project)
  const [counts, setCounts] = useState<ChatProjectItems | null>(null)
  useEffect(() => { if (project && dialog === null) void window.api.chat.items(project).then(setCounts).catch(() => undefined) }, [project, dialog])
  // al entrar en esta vista el panel lateral se abre en Archivos; al salir, la barra lateral vuelve como estaba
  useEffect(() => {
    const { sidebarOpen, tab } = useStore.getState()
    useStore.getState().set({ tab: 'files', sidebarOpen: true })
    return () => useStore.getState().set({ tab, sidebarOpen })
  }, [])
  // el historial: las conversaciones de Claude guardadas en este proyecto (las de Codex no se pueden retomar en el chat); se relee al terminar una respuesta
  const [history, setHistory] = useState<SessionInfo[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [pinned, setPinned] = useState<string[]>([])          // las fijadas (`agente:id`, como en Uso): van arriba
  const [actions, setActions] = useState<{ session: SessionInfo; anchor: DOMRect } | null>(null)          // el menú «⋯» de una del historial
  const [renaming, setRenaming] = useState<SessionInfo | null>(null)
  const anyRunning = chat.running || chat.tabs.some((x) => x.id !== chat.tab && x.running)
  const reload = (): void => {
    if (!project) return
    void Promise.all([window.api.usage.collect(project, false), window.api.usage.names(), window.api.settings.get('pinned_sessions')])
      .then(([u, n, p]) => { setHistory(u.history.filter((x) => x.command === 'claude')); setNames(n); setPinned(Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : []) }).catch(() => undefined)
  }
  useEffect(() => { if (!anyRunning) reload() }, [project, anyRunning, chat.tabs.length])  // eslint-disable-line react-hooks/exhaustive-deps
  const keyOf = (x: SessionInfo): string => `${x.command}:${x.id}`
  const titleOf = (x: SessionInfo): string => names[keyOf(x)] || x.title
  const open = new Set([chat.session, ...chat.tabs.filter((x) => x.id !== chat.tab).map((x) => x.session)].filter(Boolean))          // las que ya están abiertas no se repiten
  const past = history.filter((x) => !open.has(x.id) && (pinned.includes(keyOf(x)) || history.indexOf(x) < 50))
    .sort((a, b) => Number(pinned.includes(keyOf(b))) - Number(pinned.includes(keyOf(a))))          // las fijadas primero; el resto conserva su orden
  const togglePin = (x: SessionInfo): void => { const next = pinned.includes(keyOf(x)) ? pinned.filter((k) => k !== keyOf(x)) : [...pinned, keyOf(x)]; setPinned(next); void window.api.settings.set('pinned_sessions', next) }
  const remove = (x: SessionInfo): void => {
    void confirmAsk(t('us.deleteBody', { title: titleOf(x), agent: x.agent }), t('us.delete')).then((yes) => {
      if (yes) void window.api.usage.remove(x).then((r) => { if (!r.ok) useStore.getState().toast(t('us.deleteFailed', { message: r.message }), 'error'); reload() })
    })
  }
  const resume = (x: SessionInfo): void => {
    void window.api.chat.history(x.id, x.cwd || undefined).then((h) => chat.load(x.id, project, h))
      .catch(() => useStore.getState().toast(t('us.cannotResume'), 'error'))
  }
  const now = Date.now()
  const item = 'no-drag flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] transition-colors'
  // el ancho de la columna se arrastra desde su borde derecho y se recuerda
  const [width, setWidth] = useState(() => { try { const w = Number(localStorage.getItem(SESSIONS_W_KEY)); return w >= SESSIONS_MIN && w <= SESSIONS_MAX ? w : 210 } catch { return 210 } })
  const base = useRef<number | null>(null)
  const drag = (delta: number, done: boolean): void => {
    base.current ??= width
    const w = Math.max(SESSIONS_MIN, Math.min(SESSIONS_MAX, base.current + delta))
    setWidth(w)
    if (done) { base.current = null; try { localStorage.setItem(SESSIONS_W_KEY, String(w)) } catch { /* no se recuerda */ } }
  }
  return (
    <>
    <nav style={{ width }} className="flex shrink-0 flex-col gap-0.5 overflow-hidden rounded-lg border border-line bg-panel px-1.5 py-2">
      <button onClick={(e) => onNew(e.currentTarget.getBoundingClientRect())}
        className="no-drag flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-semibold text-text transition-colors hover:bg-accent-bg disabled:opacity-50">
        <MdAdd size={16} />{t('hub.newSession')}
      </button>
      <div className="mt-2 px-2 pb-1 text-[11px] font-semibold text-muted">{t('hub.chats')}</div>
      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
        {chat.tabs.map((x) => {
          const active = x.id === chat.tab
          const first = (active ? chat.messages : x.messages).find((m) => m.role === 'user')?.text.trim().replace(/\s+/g, ' ')
          const agent = active ? chat.agent : x.agent
          const busy = active ? chat.running : x.running          // respondiendo (las demás siguen en segundo plano)
          const Icon = agent === 'codex' ? MdCode : MdChatBubbleOutline
          return (
            <div key={x.id} title={first || undefined} className={`group flex items-center gap-1.5 rounded-md pl-2 pr-1 text-[12px] transition-colors ${active ? 'bg-accent-bg text-text' : 'text-muted hover:bg-ov/[0.04] hover:text-text'}`}>
              <Icon size={12} className={`shrink-0 ${active ? 'text-accent' : ''} ${busy ? 'animate-pulse' : ''}`} />
              <button onClick={() => chat.switchTab(x.id)} className="min-w-0 flex-1 truncate py-1.5 text-left">{first || t('chat.newChat')}</button>
              <button title={t('chat.closeTab')} onClick={() => chat.closeTab(x.id)}
                className={`grid size-4 shrink-0 place-items-center rounded text-muted hover:bg-ov/10 hover:text-text disabled:opacity-40 ${active ? '' : 'opacity-0 group-hover:opacity-100'}`}><MdClose size={11} /></button>
            </div>
          )
        })}
        {/* una sola lista: primero las abiertas y después las guardadas, con la misma fila */}
        {past.map((x) => {
          const on = actions?.session === x
          const pin = pinned.includes(keyOf(x))
          return (
            <div key={x.id} title={titleOf(x)} className={`group flex items-center gap-1.5 rounded-md pl-2 pr-1 text-[12px] transition-colors ${on ? 'bg-ov/[0.04] text-text' : 'text-muted hover:bg-ov/[0.04] hover:text-text'}`}>
              {pin ? <MdPushPin size={12} className="shrink-0 text-accent" /> : <MdChatBubbleOutline size={12} className="shrink-0" />}
              <button onClick={() => resume(x)} className="min-w-0 flex-1 truncate py-1.5 text-left">{titleOf(x)}</button>
              <span className={`shrink-0 text-[10.5px] text-muted group-hover:hidden ${on ? 'hidden' : ''}`}>{short(x.end, now, t('time.now'))}</span>
              <button title={t('us.moreActions')} onClick={(e) => setActions({ session: x, anchor: e.currentTarget.getBoundingClientRect() })}
                className={`size-4 shrink-0 place-items-center rounded text-muted hover:bg-ov/10 hover:text-text ${on ? 'grid bg-ov/10 text-text' : 'hidden group-hover:grid'}`}><MdMoreHoriz size={13} /></button>
            </div>
          )
        })}
      </div>
      <div className="mt-2 border-t border-line pt-2">
        <div className="px-2 pb-1 text-[11px] font-semibold text-muted">{t('hub.customize')}</div>
        {PINNED.map((id) => CONFIG.find((x) => x.id === id)!).map((x) => {
          const on = dialog === x.id
          const n = x.count ? counts?.[x.count].length : undefined
          return (
            <button key={x.id} onClick={() => setDialog(x.id)}
              className={`${item} ${on ? 'bg-accent-bg text-text' : 'text-muted hover:bg-ov/[0.04] hover:text-text'}`}>
              <x.icon size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t(x.label)}</span>
              {!!n && <span className="shrink-0 text-[11px] text-muted">{n}</span>}
            </button>
          )
        })}
        <button onClick={() => setDialog(CONFIG.find((x) => !PINNED.includes(x.id))!.id)} className={`${item} ${dialog && !PINNED.includes(dialog) ? 'bg-accent-bg text-text' : 'text-muted hover:bg-ov/[0.04] hover:text-text'}`}>
          <MdMoreHoriz size={15} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{t('hub.seeMore')}</span>
          <span className="shrink-0 text-[11px] text-muted">{CONFIG.length - PINNED.length}</span>
        </button>
        <button onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())} className={`${item} ${menu ? 'bg-accent-bg text-text' : 'text-muted hover:bg-ov/[0.04] hover:text-text'}`}>
          <MdOutlineSettings size={16} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{t('settings.title')}</span>
        </button>
      </div>
      {dialog && <CustomizeDialog section={dialog} counts={counts} onSection={setDialog} onClose={() => setDialog(null)} />}
      {actions && (
        <Menu anchor={actions.anchor} onClose={() => setActions(null)} items={[
          { label: t('us.resume'), icon: <MdPlayArrow size={16} />, onClick: () => resume(actions.session) },
          { label: t(pinned.includes(keyOf(actions.session)) ? 'us.unpin' : 'us.pin'), icon: pinned.includes(keyOf(actions.session)) ? <MdOutlinePushPin size={15} /> : <MdPushPin size={15} />, onClick: () => togglePin(actions.session) },
          { label: t('us.renameItem'), icon: <MdEdit size={15} />, onClick: () => setRenaming(actions.session) },
          { label: t('us.deleteItem'), separator: true, hidden: pinned.includes(keyOf(actions.session)), icon: <MdDeleteOutline size={16} />, danger: true, onClick: () => remove(actions.session) }
        ]} />
      )}
      {renaming && <RenameDialog session={renaming} current={titleOf(renaming)} onClose={() => setRenaming(null)} onSaved={reload} />}
      {menu && <Menu beside="right" width={230} anchor={menu} onClose={() => setMenu(null)} items={settingsMenuItems(t)} />}
    </nav>
    <Resizer onDrag={drag} />          {/* el hueco con el chat es el propio divisor */}
    </>
  )
}

const TOOLBAR_KEY = 'tutti.hub.toolbar'          // dónde se dejó la barra flotante (por equipo: es solo comodidad)
/** La barrita flotante de la esquina: Cambios, Archivos, terminal y partir el chat. */
export function HubToolbar() {
  const t = useT()
  // Cambios y Archivos abren la barra lateral de Tutti en esa pestaña (un solo panel lateral); otro clic la cierra
  const tab = useStore((s) => (s.sidebarOpen ? s.tab : null))
  const show = (id: 'git' | 'files'): void => useStore.getState().set(tab === id ? { sidebarOpen: false } : { tab: id, sidebarOpen: true })
  const shells = useStore((s) => s.shells.length)
  const split = useStore((s) => s.chatSplit)
  // se puede mover: se arrastra por el asa de arriba y se queda donde se suelte (se recuerda); nunca se sale del panel del chat
  const bar = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ right: number; top: number }>(() => {
    try { const p = JSON.parse(localStorage.getItem(TOOLBAR_KEY) ?? 'null') as { right: number; top: number } | null; if (p && Number.isFinite(p.right) && Number.isFinite(p.top)) return p } catch { /* sin guardar: la esquina */ }
    return { right: 10, top: 10 }
  })
  const [dragging, setDragging] = useState(false)
  const clamp = (p: { right: number; top: number }): { right: number; top: number } => {
    const el = bar.current, box = el?.offsetParent as HTMLElement | null
    if (!el || !box) return p
    return { right: Math.min(Math.max(p.right, 4), Math.max(box.clientWidth - el.offsetWidth - 4, 4)), top: Math.min(Math.max(p.top, 4), Math.max(box.clientHeight - el.offsetHeight - 4, 4)) }
  }
  // si el panel se hace más pequeño, la barra vuelve a entrar
  useEffect(() => {
    const fit = (): void => setPos((p) => { const c = clamp(p); return c.right === p.right && c.top === p.top ? p : c })
    fit()
    const box = bar.current?.offsetParent
    const ro = box ? new ResizeObserver(fit) : null
    if (box && ro) ro.observe(box)
    return () => ro?.disconnect()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const grab = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY, ...pos }
    let last = pos
    setDragging(true)
    const move = (ev: PointerEvent): void => { last = clamp({ right: start.right - (ev.clientX - start.x), top: start.top + (ev.clientY - start.y) }); setPos(last) }
    const up = (): void => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      setDragging(false)
      try { localStorage.setItem(TOOLBAR_KEY, JSON.stringify(last)) } catch { /* no se recuerda: no pasa nada */ }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const btn = (title: string, on: boolean, onClick: () => void, icon: JSX.Element) => (
    <button title={title} onClick={onClick} className={`no-drag grid size-7 place-items-center rounded-full transition-colors ${on ? 'bg-accent text-bg' : 'text-muted hover:bg-ov/10 hover:text-text'}`}>{icon}</button>
  )
  return (
    <div ref={bar} style={{ right: pos.right, top: pos.top }} className={`absolute z-10 flex flex-col items-center gap-1 rounded-full bg-ov/[0.06] p-1 ring-1 backdrop-blur ${dragging ? 'ring-accent/50 shadow-lg' : 'ring-ov/[0.06]'}`}>          {/* una cápsula: los botones redondos y el activo relleno */}
      <div onPointerDown={grab} title={t('hub.moveBar')} className={`no-drag grid h-3.5 w-7 place-items-center rounded-full text-muted/60 transition-colors hover:bg-ov/10 hover:text-text ${dragging ? 'cursor-grabbing text-text' : 'cursor-grab'}`}><MdDragIndicator size={13} className="rotate-90" /></div>
      {btn(t('hub.files'), tab === 'files', () => show('files'), <MdOutlineFolder size={16} />)}
      {btn(t('hub.changes'), tab === 'git', () => show('git'), <MdOutlineDifference size={16} />)}
      <div className="h-px w-3 bg-ov/15" />
      {btn(t('hub.terminal'), shells > 0, () => { void useStore.getState().toggleShell() }, <MdTerminal size={16} />)}
      {btn(t(split ? 'chat.unsplit' : 'chat.split'), split, () => { if (!split) useChat2.getState().setAgent(useChat.getState().agent === 'claude' ? 'codex' : 'claude'); useStore.getState().set({ chatSplit: !split }) }, <MdVerticalSplit size={16} />)}
    </div>
  )
}

/** «Personalizaciones del agente»: las secciones a la izquierda (con su número) y la elegida a la derecha, con su título y para qué sirve. */
function CustomizeDialog({ section, counts, onSection, onClose }: { section: string; counts: ChatProjectItems | null; onSection: (id: string) => void; onClose: () => void }) {
  const t = useT()
  const current = CONFIG.find((x) => x.id === section) ?? CONFIG[0]
  const powers = useRef<PowersHandle>(null)
  return (
    <Modal onClose={onClose} width={900} title={t('hub.customizeTitle')}>
      <div className="flex h-[66vh] border-t border-line">
        <nav className="flex w-[190px] shrink-0 flex-col gap-px overflow-y-auto border-r border-line p-2">
          {CONFIG.map((x) => {
            const n = x.count ? counts?.[x.count].length : undefined
            return (
              <button key={x.id} onClick={() => onSection(x.id)}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${x.id === current.id ? 'bg-accent-bg text-text' : 'text-muted hover:bg-ov/[0.04] hover:text-text'}`}>
                <span className="min-w-0 flex-1 truncate">{t(x.label)}</span>
                {!!n && <span className="shrink-0 text-[11px] font-semibold text-muted">{n}</span>}
              </button>
            )
          })}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-3 px-8 pb-4 pt-6">
          <div className="shrink-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-[18px] font-semibold text-text">{t(current.label)}</h3>
              {current.tab === 'powers' && <button onClick={() => powers.current?.add()} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] text-text transition-colors hover:bg-accent-bg">{t('powers.add')}</button>}
            </div>
            <p className="m-0 mt-1.5 max-w-[560px] text-[12px] leading-relaxed text-muted">{t(`hub.desc.${current.id}` as MsgKey)}</p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <ErrorBoundary resetKey={current.id}>{current.tab === 'agents' ? <RolesList embedded /> : current.tab === 'powers' ? <PowersView ref={powers} /> : <TuttiView key={current.id} only={current.id} />}</ErrorBoundary>
          </div>
        </div>
      </div>
    </Modal>
  )
}
