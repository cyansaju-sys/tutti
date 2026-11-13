import { clsx } from 'clsx'
import { Fragment, useEffect, useState } from 'react'
import { Menu } from '../../../shared/components/Menu'
import { MdAdd, MdFlag, MdMailOutline, MdFullscreen, MdFullscreenExit, MdKeyboardArrowDown, MdMoreHoriz, MdClose, MdCreateNewFolder, MdSearch, MdTerminal } from 'react-icons/md'
import { AppIcon } from '@/shared/components/AppIcon'
import { FileIcon } from '@/shared/components/FileIcon'
import { AgentIcon } from './AgentIcon'
import { useStore, type Pane } from '@/shared/store'
import { Kbd } from '../../../shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { TerminalPane } from './TerminalPane'
import { EditorArea, DocTab } from '../../files/components/EditorArea'

/** Pestaña de un agente en la barra superior: solo se ve el cuerpo del activo (los demás siguen vivos, ocultos). */
const SHOWN_PROJECTS = 5

export function PaneTab({ pane, active }: { pane: Pane; active: boolean }) {
  const t = useT()
  const closePane = useStore((s) => s.closePane)
  const leader = useStore((s) => pane.kind === 'agent' && s.paneLeader === pane.id)
  const canLead = useStore((s) => pane.kind === 'agent' && !!s.paneLeader && s.paneLeader !== pane.id)
  const parent = useStore((s) => (pane.parentId ? s.panes.find((p) => p.id === pane.parentId) : undefined))
  const asking = useStore((s) => s.paneAsking.includes(pane.id))
  const pending = useStore((s) => s.paneInbox[pane.id] ?? 0)
  const role = useStore((s) => s.paneRoles[pane.id])
  return (
    <>
      {/* preventDefault: si no, al pulsar la pestaña el navegador quita el foco a la terminal justo después de dárselo */}
      <div onMouseDown={(e) => { e.preventDefault(); useStore.getState().focusPane(pane.id) }} className={clsx('flex min-w-[110px] max-w-[210px] shrink-0 cursor-pointer h-7 items-center gap-1 rounded-tr-lg border-b border-r border-t-2 border-r-line px-1.5 transition-colors', active ? 'border-b-surface border-t-accent bg-surface' : 'border-b-line border-t-transparent bg-bar', role?.working && !active && 'border-t-ok bg-ok/10')}>
        {pane.kind === 'agent' ? <AgentIcon name={pane.name ?? pane.title} command={pane.command} size={13} /> : <MdTerminal size={13} className="text-accent" />}
        <span className={clsx('min-w-0 flex-1 truncate text-[10.5px]', active ? 'text-text' : 'text-muted')}>{pane.title}{leader && ` · ${t('pane.leader')}`}</span>
        {role && (
          <span title={t(role.working ? 'pane.roleWorking' : 'pane.roleIdle', { role: role.title })}
            className={clsx('flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', role.working ? 'bg-ok/20 text-ok' : 'bg-ov/[0.07] text-muted')}>
            {role.working && <span className="size-1.5 animate-pulse rounded-full bg-ok" />}{role.title}
          </span>
        )}
        {asking && <span title={t('pane.asking')} className="shrink-0 animate-pulse rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-medium text-danger">{t('pane.askingShort')}</span>}
        {pending > 0 && <span title={t('pane.inbox', { n: pending })} className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent"><MdMailOutline size={11} />{pending}</span>}
        {pane.parentId && <span title={t('pane.openedBy', { title: parent?.title ?? pane.parentId })} className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">{t('pane.subOf', { name: parent?.name ?? pane.parentId })}</span>}
        {canLead && (
          <button title={t('pane.makeLeader')} onClick={(e) => { e.stopPropagation(); void window.api.orchestra.setLeader(pane.id) }}
            className="grid size-4 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-accent"><MdFlag size={12} /></button>
        )}
        <button title={t('pane.close')} onClick={(e) => { e.stopPropagation(); closePane(pane.id) }} className="grid size-3.5 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text">
          <MdClose size={10} />
        </button>
      </div>
    </>
  )
}

export function AgentsArea() {
  const t = useT()
  const panes = useStore((s) => s.panes)
  const set = useStore((s) => s.set)
  const mode = useStore((s) => s.themeMode)
  const project = useStore((s) => s.project)
  const recentAll = useStore((s) => s.recentProjects)
  const recent = recentAll.filter((p) => p !== project)
  const setProject = useStore((s) => s.setProject)
  const removeRecent = useStore((s) => s.removeRecentProject)
  const openOther = async (): Promise<void> => {
    const picked = await window.api.dialog.chooseFolder(project ?? undefined)
    if (picked) setProject(picked)
  }
  const activePane = useStore((s) => s.activePane)
  const current = panes.find((p) => p.id === activePane)?.id ?? panes.at(-1)?.id
  const split = useStore((s) => s.paneSplit)
  const want = useStore((s) => s.paneWant)
  const docs = useStore((s) => s.docs)
  const activeDoc = useStore((s) => s.activeDoc)
  const focus = useStore((s) => s.focus)
  // los archivos se abren como una pestaña más de esta sección: al abrir uno se ve el editor y al elegir un agente, su terminal
  const [view, setView] = useState<'agent' | 'doc'>('agent')
  const [allProjects, setAllProjects] = useState(false)          // la pantalla de inicio muestra los primeros proyectos; «Ver más» enseña el resto
  // la terminal (shell) vive en su propio panel: enfocarla no debe sacar el editor para mostrar el agente
  useEffect(() => { if (focus === 'editor') setView('doc'); else if (focus === 'pane' && panes.some((p) => p.id === activePane)) setView('agent') }, [focus, activeDoc, activePane])  // eslint-disable-line react-hooks/exhaustive-deps
  const docView = view === 'doc' && docs.some((d) => d.path === activeDoc)
  // los agentes que se ven a la vez (el activo y los de la vista dividida), en el orden de la lista; el editor, cuando se ve, ocupa todo
  const visible = docView ? [] : panes.filter((p) => p.id === current || split.includes(p.id)).map((p) => p.id)
  const shown = (id: string): boolean => visible.includes(id)
  const slots = docView ? 0 : Math.max(want - visible.length, 0)          // huecos libres de la vista dividida: piden elegir un agente
  const count = Math.max(visible.length + slots, 1)
  const cols = count <= 3 ? count : count === 4 ? 2 : 3          // hasta 3 en horizontal y 2 en vertical
  const rows = Math.ceil(count / cols)
  const multi = count > 1
  // la última fila reparte todo el ancho entre sus paneles (con 5: 3 arriba y 2 abajo, a la mitad cada uno); por eso las columnas se miden en sextos
  const units = cols === 3 ? 6 : cols
  const lastRow = count - cols * (rows - 1)
  const at = (i: number): { col: string; row: number } => {
    const row = Math.floor(i / cols), span = units / (row < rows - 1 ? cols : lastRow)
    return { col: `${(i - row * cols) * span + 1} / span ${span}`, row }
  }
  const cell = (id: string): { col: string; row: number } => { const i = visible.indexOf(id); return i < 0 ? { col: '1', row: 0 } : at(i) }

  return (
    <div className="min-h-0 min-w-[260px] flex-1 overflow-hidden rounded-lg border border-line bg-surface">
      {panes.length === 0 ? (
        <div className="flex h-full flex-col items-center overflow-y-auto px-6 py-8">
          <div className="my-auto flex w-full max-w-[780px] flex-wrap items-center justify-center gap-x-12 gap-y-8">
            <div className="flex w-[300px] max-w-full flex-col items-center">
              <AppIcon src={`${import.meta.env.BASE_URL}icons/logo-contorno${mode === 'light' ? '-light' : ''}.svg`} color={mode === 'light' ? 'var(--color-accent)' : 'var(--color-accent-dim)'} alt="Tutti" size={180} />
              <p className="mt-3 text-[12px] text-muted">{t('pane.pickAgent')}</p>
              <button onClick={() => set({ modal: 'agents' })} className="mt-3 flex items-center gap-2 rounded-lg border border-line px-5 py-2.5 text-[13px] text-accent transition-colors hover:border-accent hover:bg-accent-bg">
                <MdSearch size={16} /> {t('pane.chooseAgent')}
              </button>
            </div>

            <div className="w-[380px] max-w-full">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{t('pane.projects')}</span>
                <button onClick={() => void openOther()} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-accent transition-colors hover:bg-accent-bg">
                  <MdCreateNewFolder size={14} /> {t('pane.openOther')}
                </button>
              </div>
              {recent.length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-muted">{t('pane.projectsEmpty')}</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {(allProjects ? recent : recent.slice(0, SHOWN_PROJECTS)).map((path) => (
                    <div key={path} title={path} onClick={() => setProject(path)}
                      className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent-bg">
                      <FileIcon name={path.split(/[\\/]/).filter(Boolean).pop() ?? path} project />
                      <div className="flex min-w-0 flex-1 items-baseline gap-2 text-[12px]">
                        <span className="shrink-0 text-text">{path.split(/[\\/]/).filter(Boolean).pop() ?? path}</span>
                        <span className="min-w-0 truncate text-[10px] text-muted">{path}</span>
                      </div>
                      <button title={t('pane.removeRecent')} onClick={(e) => { e.stopPropagation(); removeRecent(path) }}
                        className="grid size-5 shrink-0 place-items-center rounded text-muted opacity-0 transition-colors hover:bg-line hover:text-text group-hover:opacity-100">
                        <MdClose size={13} />
                      </button>
                    </div>
                  ))}
                  {recent.length > SHOWN_PROJECTS && (
                    <button onClick={() => setAllProjects((v) => !v)} className="mt-0.5 self-start rounded-md px-2.5 py-1 text-[11px] text-accent transition-colors hover:bg-accent-bg">
                      {allProjects ? t('pane.showLess') : t('pane.showMore', { n: recent.length - SHOWN_PROJECTS })}
                    </button>
                  )}
                </div>
              )}
              <div className="mt-6 flex w-full flex-col gap-1.5 border-t border-line pt-4">
                {([['Ctrl + Shift + N', 'pane.hintOpenAgent'], ['Ctrl + Shift + T', 'pane.hintOpenTerminal'], ['Ctrl + Shift + B', 'pane.hintHideSidebar']] as const).map(([keys, what]) => (
                  <div key={keys} className="flex items-center justify-between gap-6 text-[11px] text-muted">
                    <span>{t(what)}</span><Kbd>{keys}</Kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={clsx('grid h-full min-h-0 min-w-0 overflow-hidden', multi && 'gap-0.5 bg-bar')}
          style={{ gridTemplateColumns: `repeat(${units}, minmax(0, 1fr))`, gridTemplateRows: Array.from({ length: rows }, () => 'auto minmax(0, 1fr)').join(' ') }}>
          {/* vista dividida: cada panel es una tarjeta con su pestaña; las pestañas de los agentes ocultos y las de los archivos quedan en la primera */}
          <div style={{ gridColumn: at(0).col, gridRow: 1 }} className={clsx('flex min-w-0 overflow-x-auto overflow-y-hidden bg-bar', multi ? 'rounded-t-lg border-x border-t border-line' : '')}>
            {(multi ? panes.filter((p) => p.id === visible[0] || !shown(p.id)) : panes).map((p) => <PaneTab key={p.id} pane={p} active={shown(p.id)} />)}
            {docs.map((d) => <DocTab key={d.path} doc={d} active={docView && d.path === activeDoc} />)}
            <div className="min-w-0 flex-1 border-b border-line" />
          </div>
          {visible.slice(1).map((id) => {
            const { col, row } = cell(id)
            return (
              <div key={id} style={{ gridColumn: col, gridRow: row * 2 + 1 }} className="flex min-w-0 overflow-x-auto overflow-y-hidden rounded-t-lg border-x border-t border-line bg-bar">
                {panes.filter((p) => p.id === id).map((p) => <PaneTab key={p.id} pane={p} active />)}
              </div>
            )
          })}
          {Array.from({ length: slots }, (_, k) => {
            const { col, row } = at(visible.length + k)
            return (
              <Fragment key={`slot${k}`}>
                <div style={{ gridColumn: col, gridRow: row * 2 + 1 }} className="flex h-7 min-w-0 rounded-t-lg border-x border-t border-line bg-bar"><div className="min-w-0 flex-1 border-b border-line" /></div>
                <div style={{ gridColumn: col, gridRow: row * 2 + 2 }} className="flex min-h-0 min-w-0 flex-col items-center justify-center rounded-b-lg border-x border-b border-line">
                  <button onClick={() => set({ modal: 'agents' })} className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-[12px] text-accent transition-colors hover:border-accent hover:bg-accent-bg">
                    <MdSearch size={15} /> {t('pane.chooseAgent')}
                  </button>
                </div>
              </Fragment>
            )
          })}
          {docs.length > 0 && (
            <div style={{ gridColumn: '1 / -1', gridRow: 2 }} className={clsx('flex min-h-0 min-w-0 flex-col overflow-hidden', !docView && 'invisible pointer-events-none')}><EditorArea embedded /></div>
          )}
          {panes.map((p) => {
            const { col, row } = cell(p.id)
            return (
              <div key={p.id} style={{ gridColumn: col, gridRow: row * 2 + 2 }} onMouseDown={() => useStore.getState().focusPane(p.id)}
                className={clsx('flex min-h-0 min-w-0 flex-col overflow-hidden', !shown(p.id) && 'invisible pointer-events-none', multi && shown(p.id) && 'rounded-b-lg border-x border-b border-line')}>
                <TerminalPane pane={p} active={!docView && p.id === current} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** El panel de terminales (como el de VS Code): barra de acciones arriba a la derecha y, con varias, la lista de terminales al costado. */
export function TerminalSection() {
  const t = useT()
  const shells = useStore((s) => s.shells)
  const active = useStore((s) => s.shellActive)
  const max = useStore((s) => s.shellMax)
  const height = useStore((s) => s.shellHeight)
  const set = useStore((s) => s.set)
  const addShell = useStore((s) => s.addShell)
  const closePane = useStore((s) => s.closePane)
  const closeShells = useStore((s) => s.closeShells)
  const [menu, setMenu] = useState<{ anchor: DOMRect; kind: 'new' | 'more' } | null>(null)
  const open = (kind: 'new' | 'more') => (e: React.MouseEvent<HTMLButtonElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ kind, anchor: new DOMRect(r.left, r.bottom, 200, 0) })
  }
  const activePane = useStore((s) => s.activePane)
  // lo que corre en cada terminal (node, vim…): si es solo el shell, se queda su nombre
  const [running, setRunning] = useState<Record<string, string>>({})
  useEffect(() => {
    const ids = shells.map((s) => s.id)
    let alive = true
    const poll = (): void => { void window.api.pty.foreground(ids).then((r) => { if (alive) setRunning((prev) => (JSON.stringify(prev) === JSON.stringify(r) ? prev : r)) }) }
    poll()
    const i = setInterval(poll, 1500)
    return () => { alive = false; clearInterval(i) }
  }, [shells])
  const label = (p: { id: string; title: string }): string => { const r = running[p.id]?.split(/[\\/]/).pop()?.replace(/\.exe$/i, ''); return r || p.title }
  return (
    <div style={max ? undefined : { height }} className={clsx('flex min-h-[140px] overflow-hidden rounded-lg border border-line bg-surface', max ? 'absolute inset-0 z-10' : 'shrink-0')}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-2.5 py-1">
          <span className="text-[11px] font-medium text-muted">{t('term.title')}</span>
          <div className="flex items-center gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5 mr-1 max-w-[140px] text-[11px] font-medium text-muted"><MdTerminal size={14} className="shrink-0" /><span className="truncate">{(() => { const sh = shells.find((x) => x.id === active) ?? shells[0]; return sh ? label(sh) : t('term.title') })()}</span></span>
            <button title={t('term.new')} onClick={() => void addShell()} className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text"><MdAdd size={16} /></button>
            <button title={t('term.newOptions')} onClick={open('new')} className="grid h-6 w-4 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text"><MdKeyboardArrowDown size={14} /></button>
            <button title={t('term.moreActions')} onClick={open('more')} className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text"><MdMoreHoriz size={16} /></button>
            <button title={max ? t('term.restore') : t('term.maximize')} onClick={() => set({ shellMax: !max })} className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text">
              {max ? <MdFullscreenExit size={15} /> : <MdFullscreen size={15} />}
            </button>
            <button title={t('term.closePanel')} onClick={closeShells} className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text"><MdClose size={15} /></button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {shells.map((p) => (
            <div key={p.id} className={clsx('absolute inset-0 flex flex-col', p.id !== active && 'invisible pointer-events-none')}
              onMouseDown={() => useStore.getState().focusPane(p.id)}>
              <TerminalPane pane={p} active={p.id === active && activePane === p.id} />
            </div>
          ))}
        </div>
      </div>
      {shells.length > 1 && (
        <div className="flex w-[140px] shrink-0 flex-col gap-px border-l border-line p-1 pt-2">
          {shells.map((p) => (
            <div key={p.id} onClick={() => useStore.getState().focusPane(p.id)}
              className={clsx('group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors', p.id === active ? 'bg-accent-bg text-text' : 'text-muted hover:bg-accent-bg')}>
              <MdTerminal size={14} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate" title={label(p)}>{label(p)}</span>
              <button title={t('term.closeThis')} onClick={(e) => { e.stopPropagation(); closePane(p.id) }}
                className="grid size-4 shrink-0 place-items-center rounded opacity-0 transition-colors hover:bg-line group-hover:opacity-100"><MdClose size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {menu && (
        <Menu width={200} anchor={menu.anchor} onClose={() => setMenu(null)} items={menu.kind === 'new'
          ? [{ label: t('term.new'), icon: <MdAdd size={15} />, onClick: () => void addShell() }]
          : [{ label: t('term.closeAll'), icon: <MdClose size={15} />, onClick: closeShells, danger: true }]} />
      )}
    </div>
  )
}
