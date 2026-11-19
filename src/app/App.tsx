import { useEffect, useRef, useState, type ComponentType } from 'react'
import { AgentsArea, TerminalSection } from '@/features/agents/components/AgentsArea'
import { confirmAsk, useConfirm } from '@/lib/confirm'
import { AgentPicker, AddAgentDialog, BranchPicker, ConfirmDialog, GoLineDialog, ThemePicker, IconThemePicker, QuickOpenDialog, EditorSettingsDialog, ShellDialog, ShortcutsDialog, WorktreeDialog } from '@/components/dialogs'
import { EditorArea, saveDoc } from '@/features/files/components/EditorArea'
import { Footer } from '@/components/Footer'
import { Sidebar, TABS } from '@/components/Sidebar'
import { Toasts } from '@/components/Toasts'
import { TitleBar } from '@/components/TitleBar'
import { Resizer } from '@/components/ui'
import { Tooltips } from '@/components/Tooltip'
import { refreshGit } from '@/features/git/lib/gitSync'
import { t } from '@/lib/i18n'
import { comboOf, isCapturing, matchCommand } from '@/lib/keybindings'
import { cacheAccent, resolveTheme, paintAccent, paintTheme } from '@/lib/theme'
import { loadIconTheme } from '@/lib/icons'
import { loadSettings } from '@/functions/loadSettings'
import { ChatPanel } from '@/components/ChatPanel'
import { isDirty, useStore } from '@/store'

/** Diálogo que se abre con cada valor de `modal`. */
const MODALS: Record<string, ComponentType | undefined> = {
  agents: AgentPicker, addAgent: AddAgentDialog, editorSettings: EditorSettingsDialog, shell: ShellDialog, shortcuts: ShortcutsDialog,
  branches: BranchPicker, worktrees: WorktreeDialog, quickOpen: QuickOpenDialog, goLine: GoLineDialog, theme: ThemePicker, iconTheme: IconThemePicker
}
/** Los que solo tienen sentido con un proyecto abierto. */
const NEEDS_PROJECT = ['branches', 'worktrees']

/** Arrastra un divisor: parte del ancho que tenía al empezar y suma el desplazamiento. */
function useDrag(get: () => number, apply: (value: number) => void, min: number, max: number, invert = false, onDone?: (value: number) => void) {
  const base = useRef<number | null>(null)
  return (delta: number, done: boolean): void => {
    if (base.current === null) base.current = get()
    apply(Math.max(min, Math.min(max, base.current + (invert ? -delta : delta))))
    if (done) { base.current = null; onDone?.(get()) }
  }
}

export function App() {
  const s = useStore()
  const [ready, setReady] = useState(false)

  // arranque: tema de íconos, ajustes guardados y proyecto
  useEffect(() => {
    void (async () => {
      await loadIconTheme()
      const empty = await window.api.window.isEmpty()
      let reloaded: { open: string | null } | null = null        // la ventana se recargó al abrir o cambiar de proyecto: se retoma ese proyecto
      try { const raw = sessionStorage.getItem('tutti_reload'); sessionStorage.removeItem('tutti_reload'); if (raw) reloaded = JSON.parse(raw) } catch { /* sin sessionStorage */ }
      const fromArgs = reloaded ? null : await window.api.window.startProject()          // `tutti .` o `tutti archivo`: se abre eso en vez del último proyecto
      const project = (empty && !reloaded) || fromArgs ? undefined : (await window.api.settings.get('project')) as string | undefined
      const edit = await window.api.settings.get('edit_enabled')
      await loadSettings()
      const saved = (await window.api.settings.get('recent_projects')) as string[] | undefined
      const recentProjects = [...new Set([...(project ? [project] : []), ...(Array.isArray(saved) ? saved : [])])].slice(0, 10)
      useStore.setState({ project: project ?? null, recentProjects, editEnabled: edit === undefined ? true : Boolean(edit) })
      if (fromArgs) useStore.getState().setProject(fromArgs.project, fromArgs.file ?? undefined, false)            // lo guarda como último proyecto y en los recientes
      if (reloaded && project) await useStore.getState().restoreProject(project, reloaded.open ?? undefined)
      // tras actualizar: se muestran las novedades una vez (la primera instalación solo apunta la versión)
      const current = await window.api.update.version()
      const seen = (await window.api.settings.get('last_seen_version')) as string | undefined
      if (seen && seen !== current) useStore.getState().openNews(seen)
      void window.api.settings.set('last_seen_version', current)
      setReady(true)
    })()
  }, [])

  // con «Automático», el tema sigue al del sistema
  // abrir un proyecto no crea .tutti: la carpeta (y sus subcarpetas: specs, docs…) aparece al añadir el primer elemento
  const project = useStore((s) => s.project)
  useEffect(() => { void window.api.hooks.watch(project) }, [project])
  useEffect(() => { const name = project?.split(/[\\/]/).filter(Boolean).pop(); document.title = name ? `Tutti - ${name}` : 'Tutti' }, [project])          // el título de la ventana
  // los archivos abiertos en el editor (relativos al proyecto): los steering por archivos (`fileMatch`) también los tienen en cuenta
  const openPaths = useStore((s) => s.docs.filter((d) => d.kind === 'text').map((d) => d.path).join('\n'))
  useEffect(() => {
    if (!project) return
    const timer = setTimeout(() => {
      const rels = openPaths.split('\n').filter((p) => p.startsWith(project)).map((p) => p.slice(project.length).replace(/^[\\/]+/, '').replace(/\\/g, '/'))
      void window.api.context.working(project, rels)
    }, 400)
    return () => clearTimeout(timer)
  }, [project, openPaths])
  useEffect(() => window.api.hooks.onRan((r) => { if (!r.ok) useStore.getState().toast(r.message, 'error') }), [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = (): void => {
      const st = useStore.getState()
      if (st.theme !== 'system') return
      const mode = resolveTheme('system')
      paintTheme(mode); st.set({ themeMode: mode })
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // el acento del sistema: se lee al arrancar, cuando el sistema avisa de que cambió y al volver a la ventana
  const sysAccent = s.sysAccent
  useEffect(() => {
    if (!ready) return
    if (!sysAccent) { paintAccent(null); useStore.setState({ accent: null }); return }
    const apply = (color: string | null): void => { if (useStore.getState().sysAccent) { cacheAccent(true, color); paintAccent(color); useStore.setState({ accent: color }) } }
    const refresh = (): void => { void window.api.theme.accent().then(apply) }
    refresh()
    const off = window.api.theme.onAccent(apply)
    window.addEventListener('focus', refresh)
    return () => { off(); window.removeEventListener('focus', refresh) }
  }, [ready, sysAccent])

  // un agente pidió abrir otro (reparto de tareas) o avisó de algo
  useEffect(() => {
    const offPane = window.api.orchestra.onOpenPane((p) => {
      const st = useStore.getState()
      st.addPane({ id: p.id, kind: 'agent', name: p.name, title: `${p.name} · ${p.cwd.split(/[\\/]/).filter(Boolean).pop() ?? ''}`, command: p.command, args: p.args ?? [], cwd: p.cwd, prompt: p.prompt, parentId: p.parentId })
    })
    const offAttention = window.api.orchestra.onAttention(({ id, name }) => {
      const st = useStore.getState()
      if (document.hasFocus() && st.activePane === id) return          // ya lo está viendo
      const message = t('app.needsInput', { agent: name.split(' · ')[0] })
      st.toast(message, 'info')
      if (document.hasFocus()) return
      const n = new Notification('Tutti', { body: message })
      n.onclick = () => { window.focus(); useStore.getState().focusPane(id) }
    })
    const offToast = window.api.orchestra.onToast((message, kind) => useStore.getState().toast(message, kind))
    const applyPanes = ({ leader, inbox, asking, roles }: import('@/shared/types').PaneState): void => useStore.setState({ paneLeader: leader, paneInbox: inbox, paneAsking: asking, paneRoles: roles })
    void window.api.orchestra.paneState().then(applyPanes)
    const offRoles = window.api.orchestra.onPaneState(applyPanes)
    return () => { offPane(); offAttention(); offToast(); offRoles() }
  }, [])

  // actualizaciones: el estado llega del proceso principal (el aviso de una versión nueva no sale como toast)
  useEffect(() => {
    const apply = (update: import('@/shared/types').UpdateState): void => {
      useStore.setState({ update })
      if (update.status === 'error') useStore.getState().toast(t('app.updateFailed', { message: update.message }), 'error')
    }
    void window.api.update.state().then(apply)
    return window.api.update.onState(apply)
  }, [])

  // git se vigila cada pocos segundos: letras en el árbol, globo del ícono y rama de la barra de título
  useEffect(() => {
    void refreshGit()
    const timer = setInterval(() => void refreshGit(), 3000)
    return () => clearInterval(timer)
  }, [s.project])

  // atajos globales (en la fase de captura: llegan antes que a la terminal o al editor)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const st = useStore.getState()
      if (st.modal || useConfirm.getState().ask || isCapturing()) return
      const doc = st.docs.find((d) => d.path === st.activeDoc)
      const combo = comboOf(e)
      if (!combo) return
      // los atajos que se pueden cambiar: cada acción dice si se encargó de la tecla (cerrar un hueco puede no hacer nada) o si solo se evita el gesto del navegador
      const run: Record<string, () => boolean | 'soft' | void> = {
        save: () => (doc ? (void saveDoc(doc), 'soft') : false),
        closeTab: () => {
          if (st.focus !== 'editor' || !doc) return st.closeSlot()
          if (!isDirty(doc)) st.closeDoc(doc.path)
          else void confirmAsk(t('app.unsaved', { title: doc.title }), t('app.closeAnyway')).then((yes) => { if (yes) useStore.getState().closeDoc(doc.path) })
          return true
        },
        quickOpen: () => { st.set({ modal: 'quickOpen' }); return true },
        quickOpenAlt: () => { st.set({ modal: 'quickOpen' }); return true },
        goLine: () => { st.set({ modal: 'goLine' }); return true },
        quit: () => { window.api.window.close(); return true },
        openAgent: () => st.set({ modal: 'agents' }),
        toggleTerminal: () => { void st.toggleShell() },
        toggleSidebar: () => st.set({ sidebarOpen: !st.sidebarOpen }),
        toggleEdit: () => st.setEdit(!st.editEnabled),
        closePanel: () => { if (st.activePane) st.closePane(st.activePane) },
        replaceProject: () => st.set({ tab: 'search', sidebarOpen: true, searchReplace: true, searchToken: st.searchToken + 1 })
      }
      for (const tab of TABS) run[`tab:${tab.id}`] = () => st.set({ tab: tab.id, sidebarOpen: true, ...(tab.id === 'search' && { searchToken: st.searchToken + 1, searchReplace: false }) })
      const cmd = matchCommand(combo, st.keys)
      if (cmd) {
        const done = run[cmd.id]?.()
        if (done === false) return
        e.preventDefault()
        if (done !== 'soft') e.stopPropagation()
        return
      }
      // los fijos: F1, cambiar de panel y repartir la vista en huecos
      if (e.key === 'F1') { e.preventDefault(); e.stopPropagation(); st.openShortcuts(); return }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'PageUp' || e.key === 'PageDown')) {
        e.preventDefault(); e.stopPropagation()
        const all = [...st.panes, ...st.shells]
        if (!all.length) return
        const i = all.findIndex((p) => p.id === st.activePane)
        st.focusPane(all[(i + (e.key === 'PageDown' ? 1 : -1) + all.length) % all.length].id)
        return
      }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && st.panes.length && /^[1-6]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); st.splitPanes(Number(e.key)) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const dragSidebar = useDrag(() => useStore.getState().sidebarWidth, (v) => s.set({ sidebarWidth: v }), 220, 520, s.sidebarSide === 'right', (v) => { void window.api.settings.set('sidebar_width', v) })
  const dragChat = useDrag(() => useStore.getState().chatWidth, (v) => s.set({ chatWidth: v }), 280, 720, s.sidebarSide !== 'right', (v) => { void window.api.settings.set('chat_width', v) })
  useEffect(() => { if (ready) void window.api.settings.set('chat_open', s.chatOpen) }, [ready, s.chatOpen])
  const dragShell = useDrag(() => useStore.getState().shellHeight, (v) => s.set({ shellHeight: v }), 140, 700, true)
  if (!ready) return <div className="h-full bg-bg" />
  const Modal = s.modal ? MODALS[s.modal] : undefined

  return (
    <div className="flex h-full flex-col bg-bg">
      <TitleBar />
      <div className={`flex min-h-0 flex-1 p-[4px] pb-1 pt-0.5 ${s.sidebarSide === 'right' ? 'flex-row-reverse' : ''}`}>
        <Sidebar />
        {s.sidebarOpen && <Resizer onDrag={dragSidebar} />}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {s.docs.length > 0 && s.panes.length === 0 ? (
              // sin agentes abiertos, el editor ocupa el espacio de «Elegir agente»
              <div className="flex min-w-[260px] flex-1 flex-col"><EditorArea /></div>
            ) : (
              <>
                <AgentsArea />
              </>
            )}
          </div>
          {(s.shells.length > 0 || s.problemsOpen) && (
            <>
              {!s.shellMax && <Resizer direction="y" onDrag={dragShell} />}
              <TerminalSection />
            </>
          )}
        </div>
        {s.chatOpen && s.project && <><Resizer onDrag={dragChat} /><div className="flex"><ChatPanel /></div></>}
      </div>
      <Footer />
      {Modal && (s.project || !NEEDS_PROJECT.includes(s.modal!)) && <Modal />}
      <ConfirmDialog />
      <Toasts />
      <Tooltips />
    </div>
  )
}
