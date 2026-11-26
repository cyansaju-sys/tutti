import { MdAdd, MdChatBubbleOutline, MdClose, MdCode, MdOutlineDifference, MdOutlineFolder, MdTerminal, MdVerticalSplit } from 'react-icons/md'
import { useEffect, useRef, useState } from 'react'
import { MdMoreHoriz, MdOutlineChecklist, MdOutlineDescription, MdOutlineDns, MdOutlineExplore, MdOutlineExtension, MdOutlineLightbulb, MdOutlineMap, MdOutlineMenuBook, MdOutlineSettings, MdOutlineSmartToy, MdOutlineWebhook } from 'react-icons/md'
import type { MsgKey } from '@/shared/i18n'
import { useT } from '@/lib/i18n'
import { Menu } from './Menu'
import { settingsMenuItems } from './Sidebar'
import { TuttiView } from '@/features/tutti/views/TuttiView'
import { RolesList } from '@/features/files/views/FilesView'
import { PowersView, type PowersHandle } from '@/features/powers/views/PowersView'
import { Modal } from './ui'
import { ErrorBoundary } from './ErrorBoundary'
import type { ChatProjectItems } from '@/shared/types'
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

/** La columna de chats: sustituye a las pestañas de arriba. */
/** Las que se ven en la columna; el resto está en «Ver más» (el diálogo las tiene todas). */
const PINNED = ['agents', 'mcp', 'skills', 'hooks', 'steering', 'specs']

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
  const item = 'no-drag flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] transition-colors'
  return (
    <nav className="flex w-[210px] shrink-0 flex-col gap-0.5 border-r border-line bg-bg/40 px-1.5 py-2">
      <button onClick={(e) => onNew(e.currentTarget.getBoundingClientRect())} disabled={chat.running}
        className="no-drag flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-semibold text-text transition-colors hover:bg-accent-bg disabled:opacity-50">
        <MdAdd size={16} />{t('hub.newSession')}
      </button>
      <div className="mt-2 px-2 pb-1 text-[11px] font-semibold text-muted">{t('hub.chats')}</div>
      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
        {chat.tabs.map((x) => {
          const active = x.id === chat.tab
          const first = (active ? chat.messages : x.messages).find((m) => m.role === 'user')?.text.trim().replace(/\s+/g, ' ')
          const agent = active ? chat.agent : x.agent
          const busy = active && chat.running
          const Icon = agent === 'codex' ? MdCode : MdChatBubbleOutline
          return (
            <div key={x.id} title={first || undefined} className={`group flex items-center gap-1.5 rounded-md pl-2 pr-1 text-[12px] transition-colors ${active ? 'bg-accent-bg text-text' : 'text-muted hover:bg-ov/[0.04] hover:text-text'}`}>
              <Icon size={12} className={`shrink-0 ${active ? 'text-accent' : ''} ${busy ? 'animate-pulse' : ''}`} />
              <button disabled={chat.running && !active} onClick={() => chat.switchTab(x.id)} className="min-w-0 flex-1 truncate py-1.5 text-left disabled:opacity-50">{first || t('chat.newChat')}</button>
              <button disabled={chat.running && active} title={t('chat.closeTab')} onClick={() => chat.closeTab(x.id)}
                className={`grid size-4 shrink-0 place-items-center rounded text-muted hover:bg-ov/10 hover:text-text disabled:opacity-40 ${active ? '' : 'opacity-0 group-hover:opacity-100'}`}><MdClose size={11} /></button>
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
      {menu && <Menu beside="right" width={230} anchor={menu} onClose={() => setMenu(null)} items={settingsMenuItems(t)} />}
    </nav>
  )
}

/** La barrita flotante de la esquina: Cambios, Archivos, terminal, partir el chat y cerrarlo. */
export function HubToolbar() {
  const t = useT()
  // Cambios y Archivos abren la barra lateral de Tutti en esa pestaña (un solo panel lateral); otro clic la cierra
  const tab = useStore((s) => (s.sidebarOpen ? s.tab : null))
  const show = (id: 'git' | 'files'): void => useStore.getState().set(tab === id ? { sidebarOpen: false } : { tab: id, sidebarOpen: true })
  const shells = useStore((s) => s.shells.length)
  const split = useStore((s) => s.chatSplit)
  const btn = (title: string, on: boolean, onClick: () => void, icon: JSX.Element) => (
    <button title={title} onClick={onClick} className={`no-drag grid size-7 place-items-center rounded-md transition-colors hover:bg-ov/10 ${on ? 'text-accent' : 'text-muted hover:text-text'}`}>{icon}</button>
  )
  return (
    <div className="absolute right-2 top-2 z-10 flex flex-col items-center gap-0.5 rounded-lg border border-line bg-bg/85 p-0.5 shadow-lg backdrop-blur">
      {btn(t('hub.files'), tab === 'files', () => show('files'), <MdOutlineFolder size={16} />)}
      {btn(t('hub.changes'), tab === 'git', () => show('git'), <MdOutlineDifference size={16} />)}
      <div className="my-0.5 h-px w-5 bg-line" />
      {btn(t('hub.terminal'), shells > 0, () => { void useStore.getState().toggleShell() }, <MdTerminal size={16} />)}
      {btn(t(split ? 'chat.unsplit' : 'chat.split'), split, () => { if (!split) useChat2.getState().setAgent(useChat.getState().agent === 'claude' ? 'codex' : 'claude'); useStore.getState().set({ chatSplit: !split }) }, <MdVerticalSplit size={16} />)}
      {btn(t('chat.close'), false, () => useStore.getState().set({ chatOpen: false }), <MdClose size={16} />)}
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
