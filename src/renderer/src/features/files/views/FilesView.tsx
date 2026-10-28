import { clsx } from 'clsx'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MdChevronRight, MdContentCopy, MdContentCut, MdContentPaste, MdCreateNewFolder, MdDeleteOutline, MdDriveFileRenameOutline, MdFolderOpen, MdLink, MdNoteAdd, MdRefresh, MdSend, MdUnfoldLess } from 'react-icons/md'
import type { DirEntry } from '@shared/types'
import { Menu } from '@/shared/components/Menu'
import { Modal } from '@/shared/components/ui'
import { GIT_COLOR } from '@/features/git/lib/gitSync'
import { iconFor } from '@/shared/lib/icons'
import { basename, relative, toPosix } from '@/shared/lib/paths'
import { RolesPlan } from '@/features/agents/components/RolesPlan'
import { agentRef } from '@/features/agents/lib/agentRef'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

const dirname = (p: string): string => p.replace(/[\\/][^\\/]*$/, '')

interface Row { entry: DirEntry; depth: number }
/** Acción pendiente: crear y renombrar piden el nombre dentro del árbol; borrar pide confirmación en un diálogo. */
type Ask =
  | { kind: 'create'; dir: string; isDir: boolean }
  | { kind: 'rename'; entry: DirEntry }
  | { kind: 'delete'; entries: DirEntry[] }
  | { kind: 'move'; paths: string[]; dir: string }

export function FilesView() {
  const t = useT()
  const project = useStore((s) => s.project)
  const git = useStore((s) => s.git)
  const setProject = useStore((s) => s.setProject)
  const openDoc = useStore((s) => s.openDoc)
  const set = useStore((s) => s.set)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [children, setChildren] = useState<Record<string, DirEntry[]>>({})
  const [ignored, setIgnored] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState<string | null>(null)
  const byKey = useRef(false)          // el cursor lo movió el teclado: hay que traer su fila a la vista
  const [selected, setSelected] = useState<Set<string>>(new Set())      // selección múltiple (Shift/Ctrl + clic, Shift + ↑↓)
  const [dropOn, setDropOn] = useState<string | null>(null)            // carpeta (o la raíz) sobre la que se está arrastrando
  const [anchor, setAnchor] = useState<string | null>(null)              // de dónde parte el rango de Shift
  const [menu, setMenu] = useState<{ entry: DirEntry; anchor: DOMRect } | null>(null)
  const [rootMenu, setRootMenu] = useState<DOMRect | null>(null)      // clic en un espacio vacío: crear en la raíz del proyecto
  const toast = useStore((s) => s.toast)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [clip, setClip] = useState<{ paths: string[]; cut: boolean } | null>(null)          // el portapapeles de archivos de Tutti: copiar o cortar y pegar en otra carpeta
  const [rootOpen, setRootOpen] = useState(() => { try { return localStorage.getItem('tutti.files.rootCollapsed') !== '1' } catch { return true } })      // la raíz del proyecto es una sección plegable
  const toggleRoot = (): void => setRootOpen((o) => { try { localStorage.setItem('tutti.files.rootCollapsed', o ? '1' : '0') } catch { /* sin almacenamiento */ } return !o })
  const box = useRef<HTMLDivElement>(null)
  const creating = ask?.kind === 'create' ? ask : null
  const renaming = ask?.kind === 'rename' ? ask.entry.path : null

  const load = useCallback(async (dir: string) => {
    const entries = await window.api.fs.list(dir)
    setChildren((c) => ({ ...c, [dir]: entries }))
    if (project) {
      const hit = await window.api.git.ignored(project, entries.map((e) => e.path))
      setIgnored((prev) => new Set([...prev, ...hit]))
    }
  }, [project])

  // al cambiar de proyecto se empieza de cero
  useEffect(() => { setExpanded(new Set()); setChildren({}); setIgnored(new Set()); setCursor(null); if (project) void load(project) }, [project])  // eslint-disable-line react-hooks/exhaustive-deps
  // las carpetas abiertas se releen cuando cambia git y cada pocos segundos
  const reload = useCallback(() => { if (project) { void load(project); expanded.forEach((d) => void load(d)) } }, [project, expanded, load])
  useEffect(() => { const t = setInterval(reload, 5000); return () => clearInterval(t) }, [reload])
  useEffect(() => { reload() }, [git?.files.length])  // eslint-disable-line react-hooks/exhaustive-deps

  const status = useMemo(() => {
    const map = new Map<string, string>()
    const kinds = new Map<string, Set<string>>()                  // por carpeta: qué clases de cambio hay dentro
    const kindOf = (code: string): string => (code === 'M' || code === 'D' || code === 'C' ? code : 'A')       // A, U y R: nuevo
    if (project && git) for (const f of git.files) {
      map.set(toPosix(f.path), f.code)
      const parts = toPosix(f.path).split('/')
      for (let i = 1; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/')
        map.set(dir, '●')                                         // carpetas: un punto
        kinds.set(dir, (kinds.get(dir) ?? new Set()).add(kindOf(f.code)))
      }
    }
    // color de la carpeta: conflicto, modificada (o mezcla de nuevos y borrados), solo nuevos o solo borrados
    const tone = new Map<string, string>()
    for (const [dir, set] of kinds) tone.set(dir, set.has('C') ? 'C' : set.has('M') || set.size > 1 ? 'M' : [...set][0])
    return { map, tone }
  }, [project, git])

  const rows = useMemo(() => {
    const out: Row[] = []
    const walk = (dir: string, depth: number): void => {
      for (const entry of children[dir] ?? []) {
        out.push({ entry, depth })
        if (entry.isDir && expanded.has(entry.path)) walk(entry.path, depth + 1)
      }
    }
    if (project) walk(project, 0)
    return out
  }, [project, children, expanded])

  const toggle = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else { next.add(path); void load(path) }
      return next
    })
  }

  const activate = (row: Row): void => {
    setCursor(row.entry.path)
    set({ focus: 'tree' })
    if (row.entry.isDir) toggle(row.entry.path)
    else void openDoc(row.entry.path)
  }

  const clearSelection = (): void => { setSelected(new Set()); setAnchor(null) }
  /** Selecciona desde el ancla (o la fila marcada) hasta `path`, ambas incluidas. */
  const selectTo = (path: string): void => {
    const from = anchor ?? cursor ?? path
    const a = rows.findIndex((r) => r.entry.path === from), b = rows.findIndex((r) => r.entry.path === path)
    if (a < 0 || b < 0) return
    const [lo, hi] = a < b ? [a, b] : [b, a]
    setSelected(new Set(rows.slice(lo, hi + 1).map((r) => r.entry.path)))
    setAnchor(from); setCursor(path)
  }
  const toggleSelected = (path: string): void => {
    setSelected((prev) => { const next = new Set(prev); if (!next.delete(path)) next.add(path); return next })
    setAnchor(path); setCursor(path)
  }
  const onRowClick = (e: React.MouseEvent, row: Row): void => {
    set({ focus: 'tree' })
    if (e.shiftKey) { selectTo(row.entry.path); return }
    if (e.ctrlKey || e.metaKey) { toggleSelected(row.entry.path); return }
    clearSelection(); activate(row)
  }
  /** Las filas que afecta una acción: toda la selección si la fila pulsada es parte de ella, o solo esa fila. */
  const targetsOf = (entry: DirEntry): DirEntry[] => (selected.size > 1 && selected.has(entry.path) ? rows.filter((r) => selected.has(r.entry.path)).map((r) => r.entry) : [entry])

  /** Mueve lo arrastrado a `dir`: las pestañas abiertas siguen a sus archivos y la carpeta de destino se abre. */
  const moveTo = async (paths: string[], dir: string): Promise<void> => {
    setDropOn(null)
    let moved = false
    for (const path of paths) {
      const res = await window.api.fs.move(path, dir)
      if (!res.ok) { toast(res.message, 'error'); continue }
      if (res.message !== path) { useStore.getState().renameDocs(path, res.message); moved = true }
    }
    if (!moved) return
    clearSelection()
    setExpanded((p) => new Set(p).add(dir))
    reload(); void load(dir)
  }
  const dragPaths = (entry: DirEntry): string[] => {
    const group = selected.size > 1 && selected.has(entry.path) ? rows.filter((r) => selected.has(r.entry.path)).map((r) => r.entry.path) : [entry.path]
    const inside = (p: string, o: string): boolean => p.startsWith(o + '/') || p.startsWith(o + '\\')
    return group.filter((p) => !group.some((o) => o !== p && inside(p, o)))      // sin los que ya van dentro de otra carpeta arrastrada
  }
  const dropTarget = (e: React.DragEvent, dir: string): boolean => {
    if (!e.dataTransfer.types.includes('application/x-tutti-paths')) return false
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    if (dropOn !== dir) setDropOn(dir)
    return true
  }
  const dropped = (e: React.DragEvent, dir: string): void => {
    const raw = e.dataTransfer.getData('application/x-tutti-paths')
    if (!raw) return
    e.preventDefault(); e.stopPropagation()
    const paths = (JSON.parse(raw) as string[]).filter((p) => dirname(p) !== dir)       // los que ya están ahí no hace falta preguntarlos
    setDropOn(null)
    if (paths.length) setAsk({ kind: 'move', paths, dir })                              // antes de mover, se pide confirmación
  }

  /** Crea dentro de `dir`: se abre la carpeta y el campo de nombre aparece en el propio árbol. */
  const startCreate = (dir: string, isDir: boolean): void => {
    setRootOpen(true)                                              // el campo de nombre vive en el árbol: que se vea
    if (dir !== project) { setExpanded((p) => new Set(p).add(dir)); void load(dir) }
    setAsk({ kind: 'create', dir, isDir })
  }

  /** Pone en el portapapeles de archivos lo marcado (sin las que ya van dentro de otra carpeta marcada). */
  const clipEntries = (entries: DirEntry[], cut: boolean): void => {
    const paths = entries.map((e) => e.path)
    setClip({ paths: paths.filter((p) => !paths.some((o) => o !== p && (p.startsWith(o + '/') || p.startsWith(o + '\\')))), cut })
  }
  /** Pega en `dir`: cortar mueve (y vacía el portapapeles), copiar duplica sin pisar nada. */
  const pasteInto = async (dir: string): Promise<void> => {
    if (!clip) return
    if (clip.cut) { await moveTo(clip.paths, dir); setClip(null); return }
    for (const path of clip.paths) {
      const res = await window.api.fs.copy(path, dir)
      if (!res.ok) toast(res.message, 'error')
    }
    setExpanded((p) => new Set(p).add(dir)); reload(); void load(dir)
  }
  const pasteDirOf = (entry: DirEntry): string => (entry.isDir ? entry.path : dirname(entry.path))

  const copy = (text: string): void => { navigator.clipboard.writeText(text).catch(() => toast(t('fs.copyFailed'), 'error')) }

  /** Escribe la ruta en el agente activo (sin Enter, para que el usuario siga escribiendo). */
  const sendToAgent = (entries: DirEntry[]): void => {
    const { panes, activePane } = useStore.getState()
    const pane = panes.find((p) => p.id === activePane && p.kind === 'agent') ?? panes.find((p) => p.kind === 'agent')
    if (!pane) { toast(t('fs.noAgent'), 'error'); return }
    window.api.pty.write(pane.id, entries.map((e) => agentRef(pane.command, toPosix(relative(project!, e.path)))).join(' ') + ' ')
    useStore.getState().focusPane(pane.id)
  }

  const run = async (job: Promise<{ ok: boolean; message: string }>, after: (message: string) => void): Promise<void> => {
    const res = await job
    if (!res.ok) { toast(res.message, 'error'); return }
    after(res.message)
    reload()
  }
  const confirmAsk = async (value: string): Promise<void> => {
    if (!ask) return
    const current = ask
    setAsk(null)
    if (current.kind === 'create') {
      await run(window.api.fs.create(current.dir, value, current.isDir), (path) => {
        setExpanded((p) => new Set(p).add(current.dir)); void load(current.dir)
        if (!current.isDir) void openDoc(path)
      })
    } else if (current.kind === 'move') {
      await moveTo(current.paths, current.dir)
    } else if (current.kind === 'rename') {
      await run(window.api.fs.rename(current.entry.path, value), (to) => { useStore.getState().renameDocs(current.entry.path, to); setCursor(to) })
    } else {
      for (const entry of current.entries) await run(window.api.fs.trash(entry.path), () => useStore.getState().dropDocs(entry.path))
      clearSelection()
    }
  }

  useEffect(() => {
    if (!byKey.current || !cursor) return
    byKey.current = false
    const el = [...(box.current?.querySelectorAll('button[title]') ?? [])].find((b) => b.getAttribute('title') === cursor)
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor, rows])

  // navegación con el teclado: ↑↓ mueven la selección, → abre, ← cierra o sube, Enter abre, Esc devuelve el teclado a la terminal
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const k = e.key.toLowerCase()
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (k === 'c' || k === 'x' || k === 'v')) {          // Ctrl+C / Ctrl+X / Ctrl+V sobre el árbol
      const cur = rows.find((r) => r.entry.path === cursor)
      if (k === 'v') { void pasteInto(cur ? pasteDirOf(cur.entry) : project!); e.preventDefault(); return }
      const entries = selected.size > 0 ? rows.filter((r) => selected.has(r.entry.path)).map((r) => r.entry) : cur ? [cur.entry] : []
      if (entries.length) { clipEntries(entries, k === 'x'); e.preventDefault() }
      return
    }
    const menuKey = e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (menuKey) {          // la tecla de menú abre el de la fila marcada (la que sigue al ratón), no la que tenga el foco del navegador
      const target = rows.find((r) => r.entry.path === cursor)
      const el = target && [...e.currentTarget.querySelectorAll('button[title]')].find((b) => b.getAttribute('title') === target.entry.path)
      if (target && el) { const r = el.getBoundingClientRect(); setMenu({ entry: target.entry, anchor: new DOMRect(r.left + 24 + 190, r.bottom, 0, 0) }); e.preventDefault() }
      return
    }
    const i = rows.findIndex((r) => r.entry.path === cursor)
    const current = rows[i]
    byKey.current = true
    const go = (n: number): void => { const r = rows[Math.max(0, Math.min(rows.length - 1, n))]; if (r) setCursor(r.entry.path) }
    const extend = (n: number): void => { const r = rows[Math.max(0, Math.min(rows.length - 1, n))]; if (r) selectTo(r.entry.path) }
    if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {          // Shift + ↑↓: amplía la selección desde el ancla
      extend(e.key === 'ArrowDown' ? i + 1 : (i < 0 ? 0 : i - 1)); e.preventDefault(); return
    }
    if (e.shiftKey) return
    if (e.key === 'Delete' && (selected.size > 0 || current)) {
      const entries = selected.size > 0 ? rows.filter((r) => selected.has(r.entry.path)).map((r) => r.entry) : [current.entry]
      setAsk({ kind: 'delete', entries }); e.preventDefault(); return
    }
    if (e.key === 'Escape' && selected.size > 0) { clearSelection(); e.preventDefault(); return }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) clearSelection()
    switch (e.key) {
      case 'ArrowDown': go(i + 1); break
      case 'ArrowUp': go(i < 0 ? 0 : i - 1); break
      case 'ArrowRight':
        if (current?.entry.isDir && !expanded.has(current.entry.path)) toggle(current.entry.path)
        else if (current?.entry.isDir) go(i + 1)
        break
      case 'ArrowLeft':
        if (current?.entry.isDir && expanded.has(current.entry.path)) toggle(current.entry.path)
        else if (current) { const parent = rows.slice(0, i).reverse().find((r) => r.depth < current.depth); if (parent) setCursor(parent.entry.path) }
        break
      case 'Enter': if (current) activate(current); break
      case 'Escape': set({ focus: 'pane' }); return
      default: return
    }
    e.preventDefault()
  }

  if (!project) {
    return (
      <div className="px-2">
        <button onClick={() => void chooseProject(setProject)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px] text-accent transition-colors hover:bg-accent-bg">
          <MdFolderOpen size={16} /> Abrir proyecto
        </button>
        <p className="px-3 pt-2 text-[11px] text-muted">{t('fs.openProject')}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pl-3 pr-2 pb-1">
        <button onClick={toggleRoot} title={project} aria-expanded={rootOpen} className="flex min-w-0 items-center gap-0.5 rounded px-1 py-1 text-left transition-colors hover:text-accent">
          <MdChevronRight size={14} className={clsx('shrink-0 text-muted transition-transform', rootOpen && 'rotate-90')} />
          <span className="truncate text-[12px] font-semibold">{basename(project)}</span>
        </button>
        <div className="flex items-center">
          {[
            { title: t('fs.newFile'), icon: <MdNoteAdd size={16} />, onClick: () => startCreate(project, false) },
            { title: t('fs.newFolder'), icon: <MdCreateNewFolder size={16} />, onClick: () => startCreate(project, true) },
            { title: t('fs.refresh'), icon: <MdRefresh size={16} />, onClick: reload },
            { title: t('fs.collapse'), icon: <MdUnfoldLess size={16} />, onClick: () => setExpanded(new Set()) },
            { title: t('fs.openOther'), icon: <MdFolderOpen size={16} />, onClick: () => void chooseProject(setProject) }
          ].map((b) => (
            <button key={b.title} title={b.title} onClick={b.onClick} className="grid size-[26px] place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent">{b.icon}</button>
          ))}
        </div>
      </div>
      {/* un solo scroll para todo el explorador: el árbol y, debajo, los roles */}
      <div className="min-h-0 flex-1 overflow-y-auto"
        onContextMenu={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); setRootMenu(new DOMRect(e.clientX + 190, e.clientY, 0, 0)) } }}>      {/* el hueco bajo el árbol también abre el menú de la raíz */}
      {rootOpen && <div ref={box} tabIndex={0} onKeyDown={onKeyDown} onFocus={() => set({ focus: 'tree' })} className={clsx('px-1 pb-2 outline-none', dropOn === project && 'bg-accent/5 ring-1 ring-inset ring-accent/40')}
        onDragOver={(e) => { dropTarget(e, project) }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDropOn(null) }} onDrop={(e) => dropped(e, project)}
        onClick={(e) => { if (e.target === e.currentTarget) setRootMenu(new DOMRect(e.clientX + 190, e.clientY, 0, 0)) }}
        onContextMenu={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); setRootMenu(new DOMRect(e.clientX + 190, e.clientY, 0, 0)) } }}>
        {creating && creating.dir === project && <NameInput isDir={creating.isDir} depth={0} onOk={(v) => void confirmAsk(v)} onCancel={() => setAsk(null)} />}
        {rows.length === 0 && !creating && <p className="px-3 py-1 text-[11px] text-muted">{t('fs.emptyFolder')}</p>}
        {rows.map((row) => {
          const { entry, depth } = row
          const rel = toPosix(relative(project, entry.path))
          const code = status.map.get(rel)
          const color = code ? (GIT_COLOR[code === '●' ? (status.tone.get(rel) ?? '') : code] ?? 'var(--color-text)') : undefined
          return (
            <Fragment key={entry.path}>
            {renaming === entry.path ? <NameInput isDir={entry.isDir} depth={depth} initial={entry.name} onOk={(v) => void confirmAsk(v)} onCancel={() => setAsk(null)} /> : <button
              title={entry.path}
              onClick={(e) => onRowClick(e, row)}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('application/x-tutti-paths', JSON.stringify(dragPaths(entry))); e.dataTransfer.effectAllowed = 'move' }}
              onDragEnd={() => setDropOn(null)}
              onDragOver={(e) => { e.stopPropagation(); dropTarget(e, entry.isDir ? entry.path : dirname(entry.path)) }}
              onDrop={(e) => dropped(e, entry.isDir ? entry.path : dirname(entry.path))}
              onMouseMove={() => { if (cursor !== entry.path) { byKey.current = false; setCursor(entry.path) } }}      // el resaltado sigue al ratón (y desde ahí siguen las flechas)
              onContextMenu={(e) => {
                e.preventDefault()
                if (!(e.nativeEvent as PointerEvent).pointerType) return      // lo generó la tecla de menú: lo gestiona onKeyDown con la fila marcada
                setCursor(entry.path)
                setMenu({ entry, anchor: new DOMRect(e.clientX + 190, e.clientY, 0, 0) })      // el menú se abre justo en el cursor
              }}
              style={{ paddingLeft: 14 + depth * 12 }}
              className={clsx(
                'flex w-full items-center gap-1.5 rounded-[4px] py-[3px] pr-1.5 text-left text-[12px] transition-colors hover:bg-accent-bg',
                cursor === entry.path && 'bg-accent-bg ring-1 ring-inset ring-accent/40',
                selected.has(entry.path) && 'bg-accent/25',
                dropOn === (entry.isDir ? entry.path : dirname(entry.path)) && dropOn !== project && (entry.isDir ? 'bg-accent/30 ring-1 ring-inset ring-accent' : 'bg-accent/10'),
                ignored.has(entry.path) && 'opacity-40'
              )}
            >
              {entry.isDir ? <MdChevronRight size={14} className={clsx('-mr-0.5 shrink-0 text-muted transition-transform', expanded.has(entry.path) && 'rotate-90')} /> : <span className="-mr-0.5 w-3.5 shrink-0" />}
              <img src={iconFor(entry.name, entry.isDir, expanded.has(entry.path))} alt="" className="size-4 shrink-0" draggable={false} />
              <span className="min-w-0 flex-1 truncate" style={{ color }}>{entry.name}</span>
              {code && <span className={clsx('shrink-0 font-semibold', code === '●' ? 'text-[9px]' : 'text-[11px]')} style={{ color }}>{code}</span>}
            </button>}
            {creating && creating.dir === entry.path && <NameInput isDir={creating.isDir} depth={depth + 1} onOk={(v) => void confirmAsk(v)} onCancel={() => setAsk(null)} />}
            </Fragment>
          )
        })}
      </div>}
      </div>
      <RolesPlan />
      {rootMenu && (
        <Menu anchor={rootMenu} onClose={() => setRootMenu(null)} items={[
          { label: t('fs.newFile'), icon: <MdNoteAdd size={14} />, onClick: () => startCreate(project, false) },
          { label: t('fs.newFolder'), icon: <MdCreateNewFolder size={14} />, onClick: () => startCreate(project, true) },
          { label: t('fs.paste'), separator: true, icon: <MdContentPaste size={14} />, hidden: !clip, onClick: () => void pasteInto(project) }
        ]} />
      )}
      {menu && targetsOf(menu.entry).length > 1 && (
        <Menu anchor={menu.anchor} onClose={() => setMenu(null)} items={[
          { label: t('fs.sendMany', { n: targetsOf(menu.entry).length }), icon: <MdSend size={14} />, onClick: () => sendToAgent(targetsOf(menu.entry)) },
          { label: t('fs.cut'), icon: <MdContentCut size={14} />, onClick: () => clipEntries(targetsOf(menu.entry), true) },
          { label: t('fs.copyEntry'), icon: <MdContentCopy size={14} />, onClick: () => clipEntries(targetsOf(menu.entry), false) },
          { label: t('fs.copyMany', { n: targetsOf(menu.entry).length }), icon: <MdLink size={14} />, onClick: () => copy(targetsOf(menu.entry).map((e) => toPosix(relative(project, e.path))).join('\n')) },
          { label: t('fs.deleteMany', { n: targetsOf(menu.entry).length }), separator: true, icon: <MdDeleteOutline size={14} />, danger: true, onClick: () => setAsk({ kind: 'delete', entries: targetsOf(menu.entry) }) }
        ]} />
      )}
      {menu && targetsOf(menu.entry).length === 1 && (
        <Menu anchor={menu.anchor} onClose={() => setMenu(null)} items={[
          { label: t('fs.sendToAgent'), icon: <MdSend size={14} />, onClick: () => sendToAgent([menu.entry]) },
          { label: t('fs.newFile'), separator: true, icon: <MdNoteAdd size={14} />, onClick: () => startCreate(menu.entry.isDir ? menu.entry.path : dirname(menu.entry.path), false) },
          { label: t('fs.newFolder'), icon: <MdCreateNewFolder size={14} />, onClick: () => startCreate(menu.entry.isDir ? menu.entry.path : dirname(menu.entry.path), true) },
          { label: t('fs.cut'), separator: true, icon: <MdContentCut size={14} />, onClick: () => clipEntries([menu.entry], true) },
          { label: t('fs.copyEntry'), icon: <MdContentCopy size={14} />, onClick: () => clipEntries([menu.entry], false) },
          { label: t('fs.paste'), icon: <MdContentPaste size={14} />, hidden: !clip, onClick: () => void pasteInto(pasteDirOf(menu.entry)) },
          { label: t('fs.rename'), separator: true, icon: <MdDriveFileRenameOutline size={14} />, onClick: () => setAsk({ kind: 'rename', entry: menu.entry }) },
          { label: t('fs.copyPath'), icon: <MdContentCopy size={14} />, onClick: () => copy(menu.entry.path) },
          { label: t('fs.copyRelative'), icon: <MdLink size={14} />, onClick: () => copy(toPosix(relative(project, menu.entry.path))) },
          { label: t('fs.delete'), separator: true, icon: <MdDeleteOutline size={14} />, danger: true, onClick: () => setAsk({ kind: 'delete', entries: [menu.entry] }) }
        ]} />
      )}
      {ask?.kind === 'move' && <MoveDialog paths={ask.paths} dest={ask.dir === project ? basename(project) : toPosix(relative(project, ask.dir))} onClose={() => setAsk(null)} onOk={() => void confirmAsk('')} />}
      {ask?.kind === 'delete' && <DeleteDialog entries={ask.entries} onClose={() => setAsk(null)} onOk={() => void confirmAsk('')} />}
    </div>
  )
}

async function chooseProject(setProject: (p: string | null) => void): Promise<void> {
  const picked = await window.api.dialog.chooseFolder(useStore.getState().project ?? undefined)
  if (picked) setProject(picked)
}

function MoveDialog({ paths, dest, onClose, onOk }: { paths: string[]; dest: string; onClose: () => void; onOk: () => void }) {
  const t = useT()
  return (
    <Modal onClose={onClose} width={400} title={t('fs.moveTitle')}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-[12px] leading-relaxed text-muted">
          {paths.length === 1 ? t('fs.moveOne', { name: basename(paths[0]), dest }) : t('fs.moveMany', { n: paths.length, dest })}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button autoFocus onClick={onOk} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{t('fs.move')}</button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteDialog({ entries, onClose, onOk }: { entries: DirEntry[]; onClose: () => void; onOk: () => void }) {
  const t = useT()
  const [first] = entries
  return (
    <Modal onClose={onClose} width={400} title={t('fs.delete')}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-[12px] leading-relaxed text-muted">
          {entries.length === 1 ? t('fs.trashNote', { name: first.name, contents: first.isDir ? t('fs.andContents') : '' }) : t('fs.trashMany', { n: entries.length })}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button autoFocus onClick={onOk} className="rounded-lg bg-danger/20 px-4 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/30">{t('fs.delete')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** Campo de nombre dentro del árbol (como en VS Code): Enter crea o renombra (`initial` = el nombre actual), Esc o salir del campo cancela. */
function NameInput({ isDir, depth, initial = '', onOk, onCancel }: { isDir: boolean; depth: number; initial?: string; onOk: (value: string) => void; onCancel: () => void }) {
  const t = useT()
  const [value, setValue] = useState(initial)
  const input = useRef<HTMLInputElement>(null)
  const ready = useRef(false)
  // el foco se pide tras montar: el menú que lo abrió acaba de cerrarse y no debe cancelarlo
  useEffect(() => { const t = setTimeout(() => { input.current?.focus(); if (initial) input.current?.setSelectionRange(0, initial.lastIndexOf('.') > 0 ? initial.lastIndexOf('.') : initial.length); ready.current = true }, 30); return () => clearTimeout(t) }, [])
  return (
    <div style={{ paddingLeft: 14 + depth * 12 }} className="flex items-center gap-1.5 py-[3px] pr-1.5">
      <span className="-mr-0.5 w-3.5 shrink-0" />
      <img src={iconFor(value || 'archivo', isDir, false)} alt="" className="size-4 shrink-0" draggable={false} />
      <input
        ref={input} value={value} spellCheck={false} placeholder={isDir ? t('fs.folderName') : t('fs.fileName')}
        onChange={(e) => setValue(e.target.value)} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && value.trim()) { if (value.trim() === initial) onCancel(); else onOk(value.trim()) } else if (e.key === 'Escape') onCancel() }}
        onBlur={() => { if (ready.current) onCancel() }}
        className="min-w-0 flex-1 rounded-[3px] bg-ov/[0.08] px-1.5 py-[1px] text-[12px] caret-accent outline-none placeholder:text-muted/70"
      />
    </div>
  )
}
