import { clsx } from 'clsx'
import type { MsgKey } from '@/shared/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MdAdd, MdOutlineSettings } from 'react-icons/md'
import { Menu, type MenuItem } from '@/components/Menu'
import { useT } from '@/lib/i18n'
import { sidebarIcon } from '@/lib/icons'
import { AppIcon } from './AppIcon'
import { useStore, type SidebarTab } from '@/store'
import { AgentsView } from '@/features/agents/views/AgentsView'
import { FilesView } from '@/features/files/views/FilesView'
import { PowersView, type PowersHandle } from '@/features/powers/views/PowersView'
import { GitView } from '@/features/git/views/GitView'
import { SearchView } from '@/features/search/views/SearchView'
import { TuttiView } from '@/features/tutti/views/TuttiView'
import { UsageView } from '@/features/usage/views/UsageView'
import { bindingOf, formatCombo } from '@/lib/keybindings'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { isHubLayout } from '@/lib/hub'
import { TAB, TAB_ON, TAB_OFF, TAB_ROW, TAB_TRACK } from './tabs'

export const TABS: Array<{ id: SidebarTab; icon: string; titleKey: MsgKey; key: string }> = [
  { id: 'files', icon: 'files', titleKey: 'tab.files', key: 'E' },
  { id: 'tutti', icon: 'tutti', titleKey: 'tab.tutti', key: 'J' },
  { id: 'agents', icon: 'agents', titleKey: 'tab.agents', key: 'A' },
  { id: 'search', icon: 'search', titleKey: 'tab.search', key: 'F' },
  { id: 'git', icon: 'git', titleKey: 'tab.git', key: 'G' },
  { id: 'powers', icon: 'mcp', titleKey: 'tab.powers', key: 'X' },
  { id: 'ai', icon: 'ai', titleKey: 'tab.ai', key: 'U' }
]

const ORDER_KEY = 'sidebar_order'

/** El menú del engranaje (tema, idioma, editor, terminal, atajos, lado de la barra): también se abre desde la columna de la vista de agentes. */
export function settingsMenuItems(t: ReturnType<typeof useT>): MenuItem[] {
  const { set, sysAccent, setSysAccent, langPref, setLang, sidebarSide: side, setSidebarSide: setSide } = useStore.getState()
  return [
          { label: t('theme.group'), submenu: [
            { label: t('theme.color'), onClick: () => set({ modal: 'theme' }) },
            { label: t('icons.title'), onClick: () => set({ modal: 'iconTheme' }) },
            { label: t('theme.accent'), checked: sysAccent, onClick: () => void setSysAccent(!sysAccent) }
          ] },
          { label: t('lang.title'), detail: t(`lang.s.${langPref}`), submenu: [
            { label: t('lang.auto'), checked: langPref === 'auto', onClick: () => setLang('auto') },
            { label: t('lang.es'), checked: langPref === 'es', onClick: () => setLang('es') },
            { label: t('lang.en'), checked: langPref === 'en', onClick: () => setLang('en') }
          ] },
          { label: t('editor.title'), onClick: () => set({ modal: 'editorSettings' }) },
          { label: t('shell.title'), onClick: () => set({ modal: 'shell' }) },
          { label: t('title.shortcuts'), onClick: () => useStore.getState().openShortcuts() },
          { label: t(side === 'left' ? 'sidebar.toRight' : 'sidebar.toLeft'), onClick: () => setSide(side === 'left' ? 'right' : 'left') }
  ]
}

/** Las pestañas en el orden guardado; las que no aparezcan en él (p. ej. una nueva) van al final en su orden de siempre. */
const ordered = (ids: string[]): typeof TABS => [...ids.flatMap((id) => TABS.filter((x) => x.id === id)), ...TABS.filter((x) => !ids.includes(x.id))]

export function Sidebar() {
  const tab = useStore((s) => s.tab)
  const set = useStore((s) => s.set)
  const saved = useStore((s) => s.sidebarWidth)
  const [viewport, setViewport] = useState(window.innerWidth)
  useEffect(() => { const on = (): void => setViewport(window.innerWidth); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on) }, [])
  const width = Math.max(180, Math.min(saved, Math.round(viewport * 0.4)))          // el ancho elegido se respeta mientras la ventana lo permita; en una estrecha, nunca pasa del 40 % (mínimo 180 px)
  const open = useStore((s) => s.sidebarOpen)
  const changes = useStore((s) => s.git?.files.length ?? 0)
  const sysAccent = useStore((s) => s.sysAccent)
  const setSysAccent = useStore((s) => s.setSysAccent)
  const langPref = useStore((s) => s.langPref)
  const setLang = useStore((s) => s.setLang)
  const side = useStore((s) => s.sidebarSide)
  const keys = useStore((s) => s.keys)
  const setSide = useStore((s) => s.setSidebarSide)
  const t = useT()
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const powers = useRef<PowersHandle>(null)
  const [order, setOrder] = useState<string[]>([])           // el orden de los iconos, a gusto del usuario
  const [dragged, setDragged] = useState<SidebarTab | null>(null)
  const [over, setOver] = useState<SidebarTab | null>(null)
  const tabs = useMemo(() => ordered(order), [order])
  const hub = useStore(isHubLayout)
  useEffect(() => { void window.api.settings.get(ORDER_KEY).then((v) => { if (Array.isArray(v)) setOrder(v.filter((x): x is string => typeof x === 'string')) }) }, [])

  // suelta `dragged` en el lugar de `target`
  const drop = (target: SidebarTab): void => {
    if (dragged && dragged !== target) {
      const ids = tabs.map((x) => x.id).filter((id) => id !== dragged)
      ids.splice(ids.indexOf(target) + (tabs.findIndex((x) => x.id === dragged) < tabs.findIndex((x) => x.id === target) ? 1 : 0), 0, dragged)
      setOrder(ids)
      void window.api.settings.set(ORDER_KEY, ids)
    }
    setDragged(null); setOver(null)
  }

  if (hub && !open) return null          // vista de agentes: los apartados están en la columna del chat; aquí solo se ve el que se abra
  return (
    <div style={{ width: hub ? width : open ? width + 48 : 48 }} className={clsx('flex shrink-0 overflow-hidden rounded-lg border border-line bg-panel', side === 'right' && 'flex-row-reverse', !open && (side === 'right' ? 'ml-1.5' : 'mr-1.5'))}>
      <div className={clsx('flex w-12 shrink-0 flex-col items-center gap-1 border-line p-0.5', side === 'right' ? 'border-l' : 'border-r', hub && 'hidden')}>
        {tabs.map((tab_) => (
          <button
            key={tab_.id}
            draggable
            onDragStart={(e) => { setDragged(tab_.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tab_.id) }}
            onDragOver={(e) => { if (dragged) { e.preventDefault(); setOver(tab_.id) } }}
            onDrop={(e) => { e.preventDefault(); drop(tab_.id) }}
            onDragEnd={() => { setDragged(null); setOver(null) }}
            title={`${t(tab_.titleKey)} (${formatCombo(bindingOf(`tab:${tab_.id}`, keys))})`}
            onClick={() => set(tab === tab_.id && open ? { sidebarOpen: false } : { tab: tab_.id, sidebarOpen: true })}
            onDoubleClick={() => set({ tab: tab_.id, sidebarOpen: !open })}
            className={clsx('relative grid size-9 place-items-center rounded-md transition-colors hover:bg-accent-bg', tab === tab_.id && 'bg-accent-bg', dragged === tab_.id && 'opacity-40', over === tab_.id && dragged !== tab_.id && 'ring-1 ring-accent')}
          >
            <AppIcon src={sidebarIcon(tab_.icon)} className="size-6" />
            {tab_.id === 'git' && changes > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-bg">
                {changes > 99 ? '99+' : changes}
              </span>
            )}
          </button>
        ))}
        <button
          title={t('settings.title')}
          onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}
          className={clsx('mt-auto grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent', menu && 'bg-accent-bg text-accent')}
        >
          <MdOutlineSettings size={22} />
        </button>
      </div>
      {menu && (
        <Menu beside={side === 'left' ? 'right' : 'left'} width={230} anchor={menu} onClose={() => setMenu(null)} items={settingsMenuItems(t)} />
      )}
      {open && <div className={clsx('flex min-w-0 flex-1 flex-col overflow-hidden', !hub && 'pt-1.5')}>
        {hub && <HubTabs tab={tab} />}
        <div className={clsx('flex items-center justify-between pb-1 pr-2', hub && tab !== 'powers' && 'hidden')}>
          <h3 className={clsx('truncate px-3.5 pb-1 pt-0.5 text-[12px] font-medium text-muted/75', hub && 'invisible')}>{t(`tt.${tab}` as MsgKey)}</h3>
          {tab === 'powers' && (
            <button title={t('powers.add')} onClick={() => powers.current?.add()}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent">
              <MdAdd size={16} />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1">
        <ErrorBoundary resetKey={tab}>
        {tab === 'files' && <FilesView />}
        {tab === 'search' && <SearchView />}
        {tab === 'agents' && <AgentsView />}
        {tab === 'git' && <GitView />}
        {tab === 'tutti' && <TuttiView />}
        {tab === 'ai' && <UsageView />}
        {tab === 'powers' && <PowersView ref={powers} />}
        </ErrorBoundary>
        </div>
      </div>}
    </div>
  )
}

/** Vista de agentes: el panel lateral lleva pestañas (Archivos, Cambios y el apartado abierto) y un «+» para los demás. */
const HUB_TABS: SidebarTab[] = ['files', 'git']
/** Lo que en la vista de agentes ya está en «Personalización» de la columna de chats: no se repite en el «+». */
const HUB_HIDDEN: SidebarTab[] = ['tutti', 'powers']
function HubTabs({ tab }: { tab: SidebarTab }) {
  const t = useT()
  const set = useStore((s) => s.set)
  const [more, setMore] = useState<DOMRect | null>(null)
  const shown = HUB_TABS.includes(tab) ? HUB_TABS : [...HUB_TABS, tab]
  const label = (id: SidebarTab): string => (id === 'git' ? t('hub.changes') : id === 'files' ? t('hub.files') : t(TABS.find((x) => x.id === id)!.titleKey))
  return (
    <div className={clsx(TAB_ROW, 'border-b border-line')}><div className={TAB_TRACK}>          {/* control segmentado, como las pestañas del chat y del editor */}
      {shown.map((id) => (
        <button key={id} onClick={() => set({ tab: id })}
          className={clsx(TAB, 'px-2.5 text-[12px]', tab === id ? TAB_ON : TAB_OFF)}>
          <AppIcon src={sidebarIcon(TABS.find((x) => x.id === id)!.icon)} className="size-4" />{label(id)}
        </button>
      ))}
      </div>
      <button title={t('hub.more')} onClick={(e) => setMore(e.currentTarget.getBoundingClientRect())} className="grid size-6 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-ov/[0.05] hover:text-text"><MdAdd size={16} /></button>
      {more && <Menu anchor={more} width={200} onClose={() => setMore(null)} items={TABS.filter((x) => !shown.includes(x.id) && !HUB_HIDDEN.includes(x.id)).map((x) => ({ label: t(x.titleKey), icon: <AppIcon src={sidebarIcon(x.icon)} className="size-4" />, onClick: () => set({ tab: x.id }) }))} />}
    </div>
  )
}
