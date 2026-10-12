import type { AgentInfo, FileData, GitStatus, UpdateState } from '@shared/types'
import type { Lang, LangPref } from '@shared/i18n'
import type { ThemeMode, ThemePref } from '@/shared/lib/theme'

export type SidebarTab = 'files' | 'search' | 'agents' | 'git' | 'mcp' | 'ai' | 'context' | 'tutti'
export type ToastKind = 'ok' | 'error' | 'info'
export type Modal = null | 'agents' | 'addAgent' | 'shortcuts' | 'branches' | 'news' | 'quickOpen' | 'goLine'
export type Focus = 'tree' | 'editor' | 'pane'

/** Pestaña de archivo o, con kind 'diff', de comparación: `original` = antes, `text` = después, `diffOf` = el archivo real. */
export interface Doc extends FileData { path: string; title: string; savedText: string; original?: string; diffOf?: string; diffLabel?: string }
export interface Pane {
  id: string; kind: 'agent' | 'shell'; title: string; command: string; args: string[]; cwd: string
  name?: string; prompt?: string; parentId?: string      // agente que lo abrió y su tarea inicial (reparto de tareas)
}
/** Lo que se recuerda de cada proyecto al dejarlo: pestaña de la barra lateral y archivos abiertos. */
export interface ProjectConfig { tab: SidebarTab; docs: string[]; activeDoc: string | null }
export interface Toast { id: number; kind: ToastKind; message: string }


/** El estado completo: la unión de los slices (cada uno vive en su archivo). */
export type State = ProjectSlice & DocsSlice & PanesSlice & UiSlice & { set: (patch: Partial<State>) => void }

export interface ProjectSlice {
  project: string | null
  recentProjects: string[]
  git: GitStatus | null
  setProject: (path: string | null) => void
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
  openSkillForm: () => void                           // el formulario de una skill nueva
  openSteeringForm: () => void                        // el formulario de un steering nuevo
  openSpecForm: () => void                            // el formulario guiado de una spec nueva
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
  openAgent: (agent: { name: string; command: string; args?: string[] }, args?: string[], opts?: { cwd?: string; title?: string; prompt?: string }) => Promise<void>
  addPane: (pane: Pane) => void
  toggleShell: () => Promise<void>
  addShell: () => Promise<void>
  closeShells: () => void
  closePane: (id: string) => void
}

export interface UiSlice {
  /** Versión de la que se muestran las novedades (la instalada, o la que se acaba de actualizar). */
  newsSince: string | null
  tab: SidebarTab
  sidebarOpen: boolean
  sidebarWidth: number
  editorWidth: number
  shellHeight: number
  editEnabled: boolean
  theme: ThemePref                       // lo elegido: oscuro, claro o el del sistema
  themeMode: ThemeMode                   // el que se está usando
  langPref: LangPref                     // lo elegido: español, inglés o el del sistema
  lang: Lang                             // el que se está usando
  searchReplace: boolean                 // Ctrl+Shift+H: el panel se abre con el campo de reemplazo
  searchToken: number                    // sube al pulsar Ctrl+Shift+F: el campo de búsqueda toma el foco
  focus: Focus
  modal: Modal
  toasts: Toast[]
  maximized: boolean
  agents: AgentInfo[]
  update: UpdateState
  toast: (message: string, kind?: ToastKind) => void
  dismissToast: (id: number) => void
  setTheme: (pref: ThemePref) => void
  setLang: (pref: LangPref) => void
  setEdit: (enabled: boolean) => void
}
