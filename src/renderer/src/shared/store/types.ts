import type { AgentInfo, FileData, GitStatus, UpdateState } from '@/shared/types'
import type { Lang, LangPref } from '@/shared/i18n'
import type { ThemeMode, ThemePref } from '@/renderer/src/shared/lib/theme'
import type { IconFlavor } from '@/renderer/src/shared/lib/icons'

export type SidebarTab = 'files' | 'search' | 'agents' | 'git' | 'ai' | 'tutti' | 'powers'
export type ToastKind = 'ok' | 'error' | 'info'
export type Modal = null | 'agents' | 'addAgent' | 'shell' | 'editorSettings' | 'shortcuts' | 'branches' | 'worktrees' | 'quickOpen' | 'goLine' | 'theme' | 'iconTheme'
export type Focus = 'tree' | 'editor' | 'pane'

/** Pestaña de archivo o, con kind 'diff', de comparación: `original` = antes, `text` = después, `diffOf` = el archivo real. */
export interface Doc extends FileData { path: string; title: string; savedText: string; original?: string; diffOf?: string; diffLabel?: string }
export interface Pane {
  id: string; kind: 'agent' | 'shell'; title: string; command: string; args: string[]; cwd: string
  name?: string; prompt?: string; parentId?: string      // agente que lo abrió y su tarea inicial (reparto de tareas)
}
/** Lo que se recuerda de cada proyecto al dejarlo: pestaña de la barra lateral, archivos abiertos y terminales. */
export interface ProjectConfig { tab: SidebarTab; docs: string[]; activeDoc: string | null; shells?: number }
/** Lo que trae una spec nueva que se crea desde un ítem del roadmap. */
export interface SpecPrefill { name: string; description: string }
export interface Toast { id: number; kind: ToastKind; message: string }


/** El estado completo: la unión de los slices (cada uno vive en su archivo). */
export type State = ProjectSlice & DocsSlice & PanesSlice & UiSlice & { set: (patch: Partial<State>) => void }

export interface ProjectSlice {
  project: string | null
  recentProjects: string[]
  git: GitStatus | null
  setProject: (path: string | null, open?: string, reload?: boolean) => void       // `open`: archivo que se abre en el editor al terminar
  restoreProject: (path: string | null, open?: string) => Promise<void>
  removeRecentProject: (path: string) => void
}

export interface DocsSlice {
  docs: Doc[]
  activeDoc: string | null
  /** Dónde colocar el cursor al abrir un resultado de búsqueda; `token` distingue dos clics en el mismo sitio. */
  reveal: { path: string; line: number; col: number; length: number; token: number } | null
  openDoc: (path: string) => Promise<void>
  openAt: (path: string, line: number, col: number, length: number) => Promise<void>
  closeDoc: (path: string) => void
  openDiff: (file: string, staged: boolean) => Promise<void>
  openGraph: () => void
  openNews: (since: string | null) => void              // las novedades como pestaña del editor: desde `since` (tras actualizar) o solo las de la versión instalada
  openRoleGraph: () => void                            // el grafo de dependencias entre roles
  openRoleForm: (edit?: { file: string; name: string }) => void                            // el formulario de un rol nuevo (solo el nombre)
  openSkillForm: () => void                           // el formulario de una skill nueva
  openSteeringForm: () => void                        // el formulario de un steering nuevo
  openSpecForm: (prefill?: SpecPrefill) => void       // el diálogo de una spec nueva (desde el roadmap, ya rellenado)
  specDialog: SpecPrefill | null                      // el diálogo de cambio nuevo, abierto (con lo que ya trae relleno) o null si está cerrado
  openHookForm: (edit?: { file: string; index: number; name?: string }) => void      // el formulario para crear un hook (o editar uno), como una pestaña más del editor
  openCommitDiff: (hash: string, parent: string | null, path: string, label: string) => Promise<void>
  renameDocs: (from: string, to: string) => void      // un archivo o carpeta cambió de nombre: sus pestañas lo siguen
  dropDocs: (path: string) => void                    // se borró: se cierran sus pestañas
  updateDocText: (path: string, text: string) => void
  markSaved: (path: string, text: string, mtimeMs: number) => void
  markExternalSeen: (path: string, mtimeMs: number) => void
  replaceDoc: (path: string, data: FileData) => void
}

export interface PanesSlice {
  panes: Pane[]
  shells: Pane[]
  shellActive: string | null
  shellMax: boolean
  activePane: string | null
  /** Agentes que se ven junto al activo al dividir la vista (Ctrl+2…6, hasta 3 en horizontal y 2 en vertical); vacío = un solo agente. */
  paneSplit: string[]
  /** Cuántos paneles se quieren ver a la vez (Ctrl+1…6): si hay menos agentes, los huecos piden elegir uno. */
  paneWant: number
  /** El rol del plan que lleva cada panel de agente (por id de panel); lo avisa la app. */
  /** Avisos de Tutti que esperan a que cada agente esté libre (o a que dejes de escribir en su panel). */
  paneInbox: Record<string, number>
  paneAsking: string[]
  paneRoles: Record<string, { role: string; title: string; working: boolean }>          // el rol que lleva cada agente (por id de panel) y si está trabajando
  /** El agente líder; null si solo hay uno abierto. */
  paneLeader: string | null
  openAgent: (agent: { name: string; command: string; args?: string[] }, args?: string[], opts?: { cwd?: string; title?: string; prompt?: string }) => Promise<void>
  addPane: (pane: Pane) => void
  toggleShell: () => Promise<void>
  addShell: () => Promise<void>
  closeShells: () => void
  closePane: (id: string) => void
  closeSlot: () => boolean                             // Ctrl+W: cierra un hueco vacío de la vista dividida (false si no hay)
  splitPanes: (n: number) => void                      // Ctrl+2…6 muestra n agentes a la vez (cuadrícula de hasta 3×2); Ctrl+1 vuelve a uno solo
  focusPane: (id: string) => void                      // selecciona el panel y le pasa el teclado (aunque ya fuera el activo)
}

export interface UiSlice {
  /** Versión de la que se muestran las novedades (la instalada, o la que se acaba de actualizar). */
  newsSince: string | null
  tab: SidebarTab
  sidebarOpen: boolean
  chatOpen: boolean                                     // panel de chat, al lado opuesto de la barra lateral
  sidebarSide: 'left' | 'right'                         // de qué lado de la ventana va la barra lateral (con sus iconos)
  editorFont: string                                    // font-family del editor de código, tal como lo escribe el usuario
  sidebarWidth: number
  editorWidth: number
  shellHeight: number
  editEnabled: boolean
  theme: ThemePref                       // lo elegido: oscuro, claro o el del sistema
  themeMode: ThemeMode                   // el que se está usando
  sysAccent: boolean                     // el color de acento sigue al del sistema
  accent: string | null                  // el color del sistema que se está pintando (#rrggbb), o null con los colores de Tutti
  iconFlavor: IconFlavor                 // la paleta de los íconos de archivos (auto = según el tema)
  iconPreview: IconFlavor | null         // paleta que se enseña mientras se pasa por ella en el menú, sin guardarla
  langPref: LangPref                     // lo elegido: español, inglés o el del sistema
  lang: Lang                             // el que se está usando
  searchReplace: boolean                 // Ctrl+Shift+H: el panel se abre con el campo de reemplazo
  searchToken: number                    // sube al pulsar Ctrl+Shift+F: el campo de búsqueda toma el foco
  focus: Focus
  paneFocus: number                      // sube al cerrar un archivo o un panel: la terminal activa recupera el foco del teclado
  modal: Modal
  toasts: Toast[]
  notices: Toast[]                       // historial de avisos (el panel de la campana)
  clearNotices: () => void
  maximized: boolean
  agents: AgentInfo[]
  update: UpdateState
  toast: (message: string, kind?: ToastKind) => void
  dismissToast: (id: number) => void
  setTheme: (pref: ThemePref) => void
  setSysAccent: (on: boolean) => Promise<void>
  setIconFlavor: (flavor: IconFlavor) => void
  setLang: (pref: LangPref) => void
  setSidebarSide: (side: 'left' | 'right') => void
  setEditorFont: (font: string) => void
  setEdit: (enabled: boolean) => void
}
