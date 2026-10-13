import { clsx } from 'clsx'
import type { MsgKey } from '@shared/i18n'
import { useState } from 'react'
import { MdAdd, MdLanguage, MdOutlineSettings, MdPalette } from 'react-icons/md'
import { Menu } from '@/shared/components/Menu'
import { useT } from '@/shared/lib/i18n'
import { sidebarIcon } from '@/shared/lib/icons'
import { useStore, type SidebarTab } from '@/shared/store'
import { AgentsView } from '@/features/agents/views/AgentsView'
import { FilesView } from '@/features/files/views/FilesView'
import { GitView } from '@/features/git/views/GitView'
import { SearchView } from '@/features/search/views/SearchView'
import { ContextView } from '@/features/context/views/ContextView'
import { TuttiView } from '@/features/tutti/views/TuttiView'
import { McpView } from '@/features/mcp/views/McpView'
import { UsageView } from '@/features/usage/views/UsageView'

export const TABS: Array<{ id: SidebarTab; icon: string; titleKey: MsgKey; key: string }> = [
  { id: 'files', icon: 'files', titleKey: 'tab.files', key: 'E' },
  { id: 'tutti', icon: 'tutti', titleKey: 'tab.tutti', key: 'J' },
  { id: 'agents', icon: 'agents', titleKey: 'tab.agents', key: 'A' },
  { id: 'context', icon: 'context', titleKey: 'tab.context', key: 'K' },
  { id: 'search', icon: 'search', titleKey: 'tab.search', key: 'F' },
  { id: 'git', icon: 'git', titleKey: 'tab.git', key: 'G' },
  { id: 'mcp', icon: 'mcp', titleKey: 'tab.mcp', key: 'X' },
  { id: 'ai', icon: 'ai', titleKey: 'tab.ai', key: 'U' }
]

export function Sidebar() {
  const tab = useStore((s) => s.tab)
  const set = useStore((s) => s.set)
  const width = useStore((s) => s.sidebarWidth)
  const open = useStore((s) => s.sidebarOpen)
  const changes = useStore((s) => s.git?.files.length ?? 0)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const langPref = useStore((s) => s.langPref)
  const setLang = useStore((s) => s.setLang)
  const t = useT()
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [addMcp, setAddMcp] = useState(0)          // sube al pulsar el + del título de MCP: la vista abre el diálogo de añadir

  return (
    <div style={{ width: open ? width + 56 : 56 }} className={clsx('flex shrink-0 overflow-hidden rounded-lg border border-line bg-panel', !open && 'mr-1.5')}>
      <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line p-0.5">
        {TABS.map((tab_) => (
          <button
            key={tab_.id}
            title={`${t(tab_.titleKey)} (Ctrl+Shift+${tab_.key})`}
            onClick={() => set(tab === tab_.id && open ? { sidebarOpen: false } : { tab: tab_.id, sidebarOpen: true })}
            onDoubleClick={() => set({ tab: tab_.id, sidebarOpen: !open })}
            className={clsx('relative grid size-9 place-items-center rounded-md transition-colors hover:bg-accent-bg', tab === tab_.id && 'bg-accent-bg')}
          >
            <img src={sidebarIcon(tab_.icon)} alt="" className="size-6" draggable={false} />
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
        <Menu width={230} anchor={menu} onClose={() => setMenu(null)} items={[
          { label: t('theme.title'), icon: <MdPalette size={15} />, detail: t(`theme.s.${theme}`), submenu: [
            { label: t('theme.dark'), checked: theme === 'dark', onClick: () => setTheme('dark') },
            { label: t('theme.light'), checked: theme === 'light', onClick: () => setTheme('light') },
            { label: t('theme.system'), checked: theme === 'system', onClick: () => setTheme('system') }
          ] },
          { label: t('lang.title'), icon: <MdLanguage size={15} />, detail: t(`lang.s.${langPref}`), submenu: [
            { label: t('lang.auto'), checked: langPref === 'auto', onClick: () => setLang('auto') },
            { label: t('lang.es'), checked: langPref === 'es', onClick: () => setLang('es') },
            { label: t('lang.en'), checked: langPref === 'en', onClick: () => setLang('en') }
          ] }
        ]} />
      )}
      {open && <div className="flex min-w-0 flex-1 flex-col overflow-hidden pt-1.5">
        <div className="flex items-center justify-between pb-1 pr-2">
          <h3 className="truncate px-3.5 pb-1 pt-0.5 text-[12px] font-medium text-muted/75">{t(`tt.${tab}` as MsgKey)}</h3>
          {tab === 'mcp' && (
            <button title={t('mcp.addTip')} onClick={() => setAddMcp((n) => n + 1)}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent">
              <MdAdd size={17} />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1">
        {tab === 'files' && <FilesView />}
        {tab === 'search' && <SearchView />}
        {tab === 'agents' && <AgentsView />}
        {tab === 'git' && <GitView />}
        {tab === 'tutti' && <TuttiView />}
        {tab === 'context' && <ContextView />}
        {tab === 'mcp' && <McpView addSignal={addMcp} />}
        {tab === 'ai' && <UsageView />}
        </div>
      </div>}
    </div>
  )
}
