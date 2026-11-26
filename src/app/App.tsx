import { useEffect, useRef, useState, type ComponentType } from 'react'
import { AgentsArea, TerminalSection } from '@/features/agents/components/AgentsArea'
import { confirmAsk, useConfirm } from '@/lib/confirm'
import { AgentPicker, AddAgentDialog, BranchPicker, ConfirmDialog, GoLineDialog, ThemePicker, IconThemePicker, QuickOpenDialog, EditorSettingsDialog, ShellDialog, ShortcutsDialog, WorktreeDialog } from '@/components/dialogs'
import { EditorArea, saveDoc } from '@/features/files/components/EditorArea'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { isHubLayout } from '@/lib/hub'
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
import { saveProjectConfig } from '@/store/project'
import { tabConv, useChat, useChat2 } from '@/store/chat'
import { HubToolbar } from '@/components/ChatHub'

/** Diálogo que se abre con cada valor de `modal`. */
const MODALS: Record<string, ComponentType | undefined> = {
  agents: AgentPicker, addAgent: AddAgentDialog, editorSettings: EditorSettingsDialog, shell: ShellDialog, shortcuts: ShortcutsDialog,
  branches: BranchPicker, worktrees: WorktreeDialog, quickOpen: QuickOpenDialog, goLine: GoLineDialog, theme: ThemePicker, iconTheme: IconThemePicker
}
/** Los que solo tienen sentido con un proyecto abierto. */
const NEEDS_PROJECT = ['branches', 'worktrees']

/** El último chat (columna) que se tocó; null si lo último fue otra cosa. */
let lastChat: number | null = null

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
      let reloaded: { open: string | null } | null = null        // la ventana se recargó al abrir o cambiar de proyecto: se retoma ese proyecto
      try { const raw = sessionStorage.getItem('tutti_reload'); sessionStorage.removeItem('tutti_reload'); if (raw) reloaded = JSON.parse(raw) } catch { /* sin sessionStorage */ }
      // lo que no depende de nada se pide a la vez (antes iba una cosa tras otra)
      const [, empty, fromArgs, last, edit, , saved] = await Promise.all([
        loadIconTheme(),
        window.api.window.isEmpty(),
        reloaded ? Promise.resolve(null) : window.api.window.startProject(),          // `tutti .` o `tutti archivo`: se abre eso en vez del último proyecto
        window.api.settings.get('project') as Promise<string | undefined>,
        window.api.settings.get('edit_enabled'),
        loadSettings(),
        window.api.settings.get('recent_projects') as Promise<string[] | undefined>
      ])
      const project = (empty && !reloaded) || fromArgs ? undefined : last
      const recentProjects = [...new Set([...(project ? [project] : []), ...(Array.isArray(saved) ? saved : [])])].slice(0, 10)
      useStore.setState({ project: project ?? null, recentProjects, editEnabled: edit === undefined ? true : Boolean(edit) })
      if (fromArgs) useStore.getState().setProject(fromArgs.project, fromArgs.file ?? undefined, false)            // lo guarda como último proyecto y en los recientes
      // retomar el proyecto y las novedades van a la vez; si algo falla o tarda demasiado (proyectos grandes), la app arranca igual
      const restoring = project && !fromArgs
        ? Promise.race([useStore.getState().restoreProject(project, reloaded?.open ?? undefined), new Promise<void>((r) => setTimeout(r, 15000))]).catch(() => undefined)          // recarga o arranque normal: se retoma lo que se dejó en este proyecto
        : Promise.resolve()
      // tras actualizar: se muestran las novedades una vez (la primera instalación solo apunta la versión)
      const news = (async () => {
        const [current, seen] = await Promise.all([window.api.update.version(), window.api.settings.get('last_seen_version') as Promise<string | undefined>])
        if (seen && seen !== current) useStore.getState().openNews(seen)
        void window.api.settings.set('last_seen_version', current)
      })().catch(() => undefined)
      await Promise.all([restoring, news])
    })().catch(() => undefined).finally(() => setReady(true))          // pase lo que pase en el arranque, la interfaz se muestra
  }, [])

  // con «Automático», el tema sigue al del sistema
  // abrir un proyecto no crea .tutti: la carpeta (y sus subcarpetas: specs, docs…) aparece al añadir el primer elemento
  const project = useStore((s) => s.project)
  useEffect(() => { void window.api.hooks.watch(project) }, [project])
  // la configuración del proyecto se guarda al cambiar (con una pausa): así sobrevive aunque la ventana se cierre sin pasar por «cambiar de proyecto»
  useEffect(() => {
    if (!ready) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const off = useStore.subscribe((st, prev) => {
      if (st.tab === prev.tab && st.docs === prev.docs && st.activeDoc === prev.activeDoc && st.shells === prev.shells && st.shellActive === prev.shellActive && st.panelTab === prev.panelTab && st.problemsOpen === prev.problemsOpen && st.shellHeight === prev.shellHeight && st.shellMax === prev.shellMax) return
      clearTimeout(timer); timer = setTimeout(() => { void saveProjectConfig(useStore.getState()) }, 600)
    })
    return () => { off(); clearTimeout(timer) }
  }, [ready])
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
    // un chat le pasa una tarea al del otro agente: el chat se parte en 2 y la tarea va a la otra columna, en una conversación del agente pedido
    const offDelegate = window.api.orchestra.onChatDelegate(({ agent, task, from, same }) => {
      // `from` es el canal del chat que la pide: la columna en el bit bajo y la conversación en el resto
      useStore.getState().setEditorFull(true)
      useStore.setState({ chatOpen: true, chatSplit: true })
      const fromTab = Math.floor(from / 2)
      const dest = from % 2 === 1 ? useChat : useChat2
      const origin = from % 2 === 1 ? useChat2 : useChat
      const st = dest.getState()
      const mine = same ? st.tabs.find((x) => { const c = tabConv(st, x.id); return c?.agent === agent && !c.running }) : undefined          // si el usuario lo pidió: la conversación que ya tenía ese agente (si está libre)
      if (mine) st.switchTab(mine.id)
      else if (st.messages.length || st.running) st.newTab(agent)          // las demás siguen respondiendo en paralelo
      else st.setAgent(agent)          // una pestaña vacía se reutiliza: no se deja un «Nuevo chat» al lado
      const tabId = dest.getState().tab
      dest.getState().queue(task)          // el panel de esa columna la envía con su modelo y modo
      // al terminar esa conversación, el chat que la pidió recibe el aviso con la respuesta
      let started = false
      const off = dest.subscribe((cur) => {
        const conv = tabConv(cur, tabId)
        if (!conv) { off(); return }          // se cerró sin terminar
        if (!started) { if (conv.running) started = true; return }
        if (conv.running) return
        off()
        const last = conv.messages.map((m) => m.role).lastIndexOf('user')
        const after = conv.messages.slice(last + 1).filter((m) => !m.parent)
        const answer = after.filter((m) => m.role === 'assistant').map((m) => m.text.trim()).filter(Boolean).join('\n\n')
        const failed = after.find((m) => m.role === 'error')
        const who = agent === 'codex' ? 'Codex' : 'Claude'
        if (tabConv(origin.getState(), fromTab)) origin.getState().switchTab(fromTab)          // la respuesta va a la conversación que la pidió
        origin.getState().note(t(failed ? 'app.delegateFailedShort' : 'app.delegateDoneShort', { agent: who }))          // una línea tenue con el aviso; la respuesta de Codex le llega al agente sin dibujarse como mensaje
        origin.getState().queue(t(failed ? 'app.delegateFailed' : 'app.delegateDone', { agent: who, text: (failed?.text ?? answer ?? '').slice(0, 4000) || '—' }), '')          // el agente recibe la respuesta de Codex, pero el mensaje no se ve en el chat: solo se ve lo que él conteste
      })
    })
    const offToast = window.api.orchestra.onToast((message, kind) => useStore.getState().toast(message, kind))
    const applyPanes = ({ leader, inbox, asking, roles }: import('@/shared/types').PaneState): void => useStore.setState({ paneLeader: leader, paneInbox: inbox, paneAsking: asking, paneRoles: roles })
    void window.api.orchestra.paneState().then(applyPanes)
    const offRoles = window.api.orchestra.onPaneState(applyPanes)
    return () => { offPane(); offAttention(); offToast(); offRoles(); offDelegate() }
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

  // el último chat que se tocó (clic o foco): Ctrl+W lo cierra aunque el cursor no esté en su caja de escritura
  useEffect(() => {
    const mark = (e: Event): void => { const el = (e.target as HTMLElement | null)?.closest?.('[data-chat-slot]'); lastChat = el ? Number((el as HTMLElement).dataset.chatSlot) : null }
    window.addEventListener('pointerdown', mark, true)
    window.addEventListener('focusin', mark, true)
    return () => { window.removeEventListener('pointerdown', mark, true); window.removeEventListener('focusin', mark, true) }
  }, [])

  // atajos globales (en la fase de captura: llegan antes que a la terminal o al editor)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const st = useStore.getState()
      if (st.modal || useConfirm.getState().ask || isCapturing()) return
      const doc = st.docs.find((d) => d.path === st.activeDoc)
      // con el cursor en un chat, Ctrl+W cierra su pestaña; si era la última, la segunda columna se cierra (el reparto en 2) y, en la primera, se vacía (o se cierra el panel si ya estaba vacía)
      const inChat = (e.target as HTMLElement | null)?.closest?.('[data-chat-slot]')
      const chatSlot = inChat ? Number((inChat as HTMLElement).dataset.chatSlot) : document.activeElement === document.body ? lastChat : null          // sin nada enfocado (se hizo clic en la conversación), vale el último chat tocado
      const chatEl = chatSlot !== null
      const closeChat = (): boolean => {
        const slot = chatSlot ?? 0
        const c = (slot === 1 ? useChat2 : useChat).getState()
        if (c.running) return true          // respondiendo: con el atajo no se cierra (la X sí, y corta la respuesta)
        if (c.tabs.length === 1 && slot === 1) st.set({ chatSplit: false })
        else if (c.tabs.length === 1 && !c.messages.length) { if (!st.editorFull) st.set({ chatOpen: false }) }          // en «Modo agentes» el chat es la vista: Ctrl+W no la cierra
        else c.closeTab(c.tab)
        return true
      }
      const combo = comboOf(e)
      if (!combo) return
      // los atajos que se pueden cambiar: cada acción dice si se encargó de la tecla (cerrar un hueco puede no hacer nada) o si solo se evita el gesto del navegador
      const run: Record<string, () => boolean | 'soft' | void> = {
        save: () => (doc ? (void saveDoc(doc), 'soft') : false),
        closeTab: () => {
          if (chatEl) return closeChat()
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
  const full = s.editorFull && s.chatOpen && !!s.project          // «Modo agentes»: el chat se estira; con un archivo abierto (o agentes o terminal) se reparte el ancho con ellos
  const alone = full && s.docs.length === 0 && s.panes.length === 0          // sin archivos ni agentes que mostrar (no sale «Elegir agente»): el chat ocupa todo el ancho; la terminal, si hay, sigue debajo

  const hub = isHubLayout(s)
  const right = s.sidebarSide === 'right' || hub          // en la vista de agentes el panel lateral va a la derecha, junto a la barra flotante
  // con «Modo agentes» la zona de trabajo es una rejilla: chat | editor arriba y la terminal debajo, a todo el ancho de los dos (como en VSCode); el contenedor del centro se vuelve transparente (`contents`) para que sus hijos entren en la rejilla sin volver a montarse
  const col = (n: number): number => (right ? n : n + 1) + (hub ? 1 : 0)          // en la vista de agentes la primera columna es la de los chats, a toda la altura          // las columnas del chat y del editor: la barra lateral ocupa la primera (izquierda) o la última (derecha)
  const chatAt = full ? { gridColumn: alone ? `${col(1)} / ${col(2) + 1}` : col(1), gridRow: 1 } : { order: 4 }
  const topAt = full ? { gridColumn: col(2), gridRow: 1 } : undefined
  const termAt = full ? { gridColumn: `${col(1)} / ${col(2) + 1}`, gridRow: s.shellMax ? '1 / -1' : 2 } : undefined

  return (
    <div className="flex h-full flex-col bg-bg">
      <TitleBar />
      <div style={full ? { gridTemplateColumns: hub ? 'auto 1fr 1fr auto' : right ? '1fr 1fr auto' : 'auto 1fr 1fr', gridTemplateRows: 'minmax(0,1fr) auto' } : undefined}
        className={`${full ? 'grid' : 'flex'} min-h-0 flex-1 p-[4px] pb-1 pt-0.5 ${!full && right ? 'flex-row-reverse' : ''}`}>
        <div style={full ? { gridColumn: hub ? 4 : right ? 3 : 1, gridRow: '1 / -1' } : undefined} className={`flex ${right ? 'flex-row-reverse' : ''}`}>
          <Sidebar />
          {s.sidebarOpen && <Resizer onDrag={dragSidebar} />}
        </div>
        {hub && <div id="hub-sessions" style={{ gridColumn: 1, gridRow: '1 / -1' }} className="flex min-h-0" />}          {/* la columna de chats de la vista de agentes: el chat la pinta aquí, a toda la altura (también junto a la terminal) */}
        <div style={full ? undefined : { order: 3 }} className={full ? 'contents' : 'relative flex min-w-0 flex-1 flex-col overflow-hidden'}>
          <div style={topAt} className={`min-h-0 min-w-0 flex-1 ${alone ? 'hidden' : 'flex'}`}>
            {s.docs.length > 0 && s.panes.length === 0 ? (
              // sin agentes abiertos, el editor ocupa el espacio de «Elegir agente»
              <div className="flex min-w-0 flex-1 flex-col"><ErrorBoundary><EditorArea /></ErrorBoundary></div>
            ) : (
              <ErrorBoundary><AgentsArea /></ErrorBoundary>
            )}
          </div>
          {(s.shells.length > 0 || s.problemsOpen) && (
            <div style={termAt} className={full ? 'relative flex min-w-0 flex-col' : 'contents'}>
              {!s.shellMax && <Resizer direction="y" onDrag={dragShell} />}
              <ErrorBoundary><TerminalSection /></ErrorBoundary>
            </div>
          )}
        </div>
        {full && (          // el chat solo existe en «Modo agentes» (el modo normal es para los agentes de terminal); con «Modo agentes» el chat va a la izquierda del editor y se reparten el ancho a medias; si no, un panel pequeño al lado
          <div style={chatAt} className={`relative flex ${full ? 'min-h-0 min-w-0' : right ? 'flex-row-reverse' : ''}`}>          {/* sin «Modo agentes» el divisor va en el borde que da al centro (con la barra a la derecha, el chat queda a la izquierda): así siempre queda el hueco entre los dos paneles */}
            {!full && <Resizer onDrag={dragChat} />}
            <ErrorBoundary><ChatPanel fill={full} hub={hub} /></ErrorBoundary>
            {s.chatSplit && <><div className="w-1 shrink-0" /><ErrorBoundary><ChatPanel fill={full} slot={1} greet={hub} /></ErrorBoundary></>}
            {hub && <HubToolbar />}          {/* la barra flotante es de toda la zona del chat (también con el chat partido), no de una columna */}          {/* el chat partido en 2: otra conversación al lado */}
            {full && !alone && <div className="w-1 shrink-0" />}          {/* el mismo hueco que deja el divisor: entre el chat y el editor */}
          </div>
        )}
      </div>
      <Footer />
      {Modal && (s.project || !NEEDS_PROJECT.includes(s.modal!)) && <Modal />}
      <ConfirmDialog />
      <Toasts />
      <Tooltips />
    </div>
  )
}
