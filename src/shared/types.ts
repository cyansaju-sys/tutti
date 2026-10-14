/** Tipos compartidos entre el proceso principal, el preload y la interfaz. */

export interface DirEntry { name: string; path: string; isDir: boolean }

export interface FileData {
  kind: 'text' | 'image' | 'binary' | 'diff' | 'graph' | 'hookform' | 'specform' | 'steeringform' | 'skillform'
  text: string
  crlf: boolean
  truncated: boolean
  readOnly: boolean       // muy grande, no UTF-8...
  mtimeMs: number
  dataUrl?: string        // imágenes
}

export interface GitFile { path: string; index: string; work: string; code: string }
export interface GitStatus { isRepo: boolean; branch: string; ahead: number; behind: number; hasUpstream: boolean; hasRemote: boolean; files: GitFile[] }
/** Rama con su último commit (fecha en ms, autor, hash corto y asunto) para mostrarla en el selector. */
export interface GitBranch { name: string; current: boolean; remote: boolean; date?: number; author?: string; hash?: string; subject?: string }
export type GitMarks = Record<number, 'added' | 'modified' | 'deleted'>

/** `custom`: lo añadió el usuario (no está en la lista conocida). `args`: argumentos fijos con los que se arranca. */
export interface AgentInfo { name: string; command: string; path: string; args?: string[]; custom?: boolean }
/** Ejecutable instalado por el usuario que podría ser un agente (para «Añadir agente»). */
export interface AgentCandidate { name: string; path: string }

export interface PtyOptions {
  id: string; command: string; args?: string[]; cwd: string; cols: number; rows: number
  kind?: 'agent' | 'shell'; name?: string       // los agentes se registran para el reparto de tareas
  prompt?: string                                // tarea inicial (agentes abiertos por otro agente)
  parentId?: string                              // agente que lo abrió
}
/** Panel que un agente pide abrir (reparto de tareas): la interfaz lo crea y su terminal inicia el proceso. */
export interface OpenPane { id: string; name: string; command: string; args?: string[]; cwd: string; prompt: string; parentId: string }
/** Una tarea que un agente delegó a otro. `closed`: el panel del agente ya no existe. */
export interface TaskInfo {
  id: number; agentId: string; agent: string; callerId: string; caller: string
  task: string; model: string | null; difficulty: string | null; startedAt: number; endedAt: number | null
  status: 'working' | 'done' | 'closed'
}
export interface PtyExit { id: string; code: number | null; error?: string }

export type McpScope = 'global' | 'project' | 'shared'
export type McpAgent = 'claude' | 'opencode' | 'gemini' | 'codex' | 'agy' | 'cursor' | 'qwen'
/** Servidor MCP ya configurado en un agente. */
export interface McpServer {
  name: string; agent: McpAgent; scope: McpScope; kind: 'remote' | 'local'; target: string
  config: Record<string, unknown>      // entrada original de la configuración
  source: string                       // archivo donde está guardada
  disabled?: boolean                   // desactivado desde Tutti: no está en el agente, la app guarda cómo estaba
}
/** Un hook de .tutti/hooks (formato de Kiro). `supported`: Tutti sabe ejecutar su trigger; `error`: por qué no es válido. */
export interface HookInfo { file: string; name: string; description: string; trigger: string; matcher: string; actionType: 'command' | 'agent' | ''; enabled: boolean; supported: boolean; error?: string }
/** Lo que hay en la carpeta `openspec/` del proyecto (OpenSpec): los cambios en marcha y las specs vigentes. */
export interface OpenSpecChange { name: string; dir: string; done: number; total: number; hasProposal: boolean; hasDesign: boolean; hasTasks: boolean }
export interface OpenSpecState {
  installed: boolean; initialized: boolean; configFile: string; schema: string
  changes: OpenSpecChange[]; archived: number
  specs: Array<{ name: string; file: string; requirements: number }>
}
/** Un archivo de .tutti/steering con lo que dice su cabecera (sin el cuerpo). */
export interface SteeringInfo { file: string; base: string; name: string; inclusion: 'always' | 'fileMatch' | 'manual' | 'auto'; patterns: string[]; description: string; scope: 'project' | 'global' }
/** Una parte de lo que reciben los agentes: el contexto global, el del proyecto o un archivo de steering. */
export interface ContextSource {
  kind: 'global' | 'project' | 'steering'; name: string; file: string; chars: number
  mode?: 'always' | 'fileMatch' | 'manual' | 'auto'; delivered?: 'full' | 'index'      // solo el steering: cuándo se entrega y si va entero o solo listado
}
/** El servidor MCP de la propia app y los agentes a los que se aplica. */
export interface AppMcpInfo {
  running: boolean; tools: string[]
  agents: Array<{ command: string; name: string; installed: boolean; applied: boolean; how: string; problem?: string }>
}
/** Un dato que el usuario debe rellenar al instalar un servidor del registro (variable de entorno o cabecera). */
export interface RegistryField { name: string; description: string; required: boolean; secret: boolean; default: string }
/** Una forma de instalar un servidor del registro: local (comando) o remota (URL). */
export interface RegistryOption {
  label: string; kind: 'remote' | 'local'
  url?: string; command?: string; args?: string[]
  env: RegistryField[]; headers: RegistryField[]
}
export interface RegistryServer { name: string; title: string; description: string; version: string; repository: string; options: RegistryOption[] }
export interface RegistryPage { servers: RegistryServer[]; next: string; error: string }
/** Lo que se necesita para añadir un servidor. */
export interface McpSpec {
  name: string; kind: 'remote' | 'local'
  url?: string; headers?: Record<string, string>
  command?: string; args?: string[]; env?: Record<string, string>
}
export type GitOp = 'tag' | 'branch' | 'checkout' | 'cherry-pick' | 'revert' | 'merge' | 'rebase' | 'reset-soft' | 'reset-mixed' | 'reset-hard'
export interface GitChangedFile { status: string; path: string; added: number; deleted: number }
export interface GitCommit { hash: string; parents: string[]; author: string; time: number; refs: string[]; subject: string }
export interface McpResult { ok: boolean; message: string }
/** Sincronización de MCP entre agentes: la fuente es Claude Code (`.mcp.json` en el proyecto, `~/.claude.json` en lo global). */
export type SyncScope = 'project' | 'global'
export interface SyncState {
  available: boolean; source: string; extras: number      // `extras`: servidores que solo están en otros agentes
  local: number                                           // los MCP de proyecto que se pueden pasar a .mcp.json (locales de Claude y sueltos de otros agentes)
  servers: Array<{ name: string; agents: Array<{ agent: McpAgent; state: 'ok' | 'missing' | 'differs' | 'disabled' | 'unsupported' | 'launch' }> }>
}
/** El AGENTS.md del proyecto y su bloque que apunta a `.tutti`: si existe, si lleva el bloque, si está al día y si además tiene texto propio. */
export interface AgentsPointerState { file: string; exists: boolean; hasBlock: boolean; upToDate: boolean; ownContent: boolean }
/** Resultado de probar un servidor MCP: si conecta y qué herramientas ofrece. */
export interface McpProbe { ok: boolean; message: string; tools: Array<{ name: string; description: string }>; ms: number }

/** Una sesión del historial de un agente. */
export interface SessionInfo {
  command: 'claude' | 'opencode' | 'agy' | 'codex'; agent: string; id: string; title: string; project: string; cwd: string
  tokens: number; start: number; end: number      // fechas en milisegundos
}
export interface LimitInfo { label: string; percent: number; resetsAt: number }
export interface AgentUsage {
  name: string; command: string
  window: { start: number; end: number; tokens: number } | null      // ventana de 5 h en curso
  today: number; week: number; total: number
  note: string; limits: LimitInfo[]; limitsError: string; limitsAge: number
}
export interface UsageData { agents: AgentUsage[]; history: SessionInfo[] }

/** Estado de las actualizaciones: `available` muestra el botón «Actualizar». */
export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string; canInstall: boolean; url: string }   // canInstall=false: se abre la página de la release
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'restarting'; version: string }
  | { status: 'error'; message: string }

export type Settings = Record<string, unknown>

export interface Api {
  settings: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }
  dialog: { chooseFolder(start?: string): Promise<string | null> }
  ai: { cancel(kind: 'commit' | 'context'): Promise<void> }
  skills: { import(project: string, source: string): Promise<McpResult> }      // copia una skill (carpeta con SKILL.md) a .tutti/skills; el SKILL.md nuevo va en `message`
  openspec: {
    state(project: string): Promise<OpenSpecState>
    init(project: string): Promise<McpResult>
    validate(project: string, change?: string): Promise<McpResult>
    archive(project: string, change: string): Promise<McpResult>
  }
  hooks: {
    list(project: string): Promise<{ hooks: HookInfo[]; trusted: boolean }>
    trust(project: string, on: boolean): Promise<void>          // autoriza (o quita) que los hooks del proyecto se ejecuten
    watch(project: string | null): Promise<void>                 // empieza a vigilar el proyecto abierto (si está autorizado)
    onRan(cb: (r: { name: string; ok: boolean; message: string }) => void): () => void
  }
  context: {
    globalSteeringDir(): Promise<string>                                                // la carpeta de los steering globales (se crea si falta)
    working(project: string, files: string[]): Promise<void>                            // los archivos abiertos en el editor, para el modo `fileMatch`
    steering(project: string): Promise<SteeringInfo[]>                                   // los steering del proyecto y su modo
    sources(project: string): Promise<ContextSource[]>                                   // qué recibirán los agentes y cuánto pesa
    init(project: string, sub?: string): Promise<string>                                 // crea .tutti (y su subcarpeta) al añadir algo; devuelve la ruta
    open(project: string): Promise<{ file: string; text: string; exists: boolean }>      // no crea el archivo: se crea al guardar
    ensureGlobal(): Promise<string>
    agents: {
      state(project: string): Promise<AgentsPointerState>          // el AGENTS.md del proyecto y su bloque que apunta a .tutti
      write(project: string): Promise<McpResult>                   // crea AGENTS.md o añade/actualiza el bloque; la ruta va en `message`
      remove(project: string): Promise<McpResult>                  // quita el bloque (y borra el archivo si se queda vacío)
    }
    generate(project: string): Promise<McpResult & { text?: string; agent?: string }>
    onAgent(cb: (name: string) => void): () => void
  }
  search: {
    run(root: string, opts: SearchOptions): Promise<SearchResult>
    replace(root: string, opts: SearchOptions, replacement: string, paths: string[]): Promise<ReplaceResult>
  }
  fs: {
    list(dir: string): Promise<DirEntry[]>
    read(path: string): Promise<FileData>
    write(path: string, text: string, crlf: boolean): Promise<number>
    mtime(path: string): Promise<number>
    create(dir: string, name: string, isDir: boolean): Promise<McpResult>
    rename(path: string, name: string): Promise<McpResult>
    move(path: string, dir: string): Promise<McpResult>              // a otra carpeta; la ruta nueva va en `message`
    copy(path: string, dir: string): Promise<McpResult>              // copia a otra carpeta (sin pisar: «nombre (2)»); la ruta nueva va en `message`
    trash(path: string): Promise<McpResult>
  }
  git: {
    status(root: string): Promise<GitStatus>
    ignored(root: string, paths: string[]): Promise<string[]>
    stage(root: string, paths: string[]): Promise<string>
    unstage(root: string, paths: string[]): Promise<string>
    discard(root: string, tracked: string[], untracked: string[]): Promise<string>      // devuelve el error, o '' si salió bien
    commit(root: string, message: string): Promise<string>
    push(root: string): Promise<string>
    branches(root: string): Promise<GitBranch[]>
    checkoutDetached(root: string, ref: string): Promise<string>
    checkout(root: string, name: string, remote: boolean): Promise<string>
    createBranch(root: string, name: string, base?: string, switchTo?: boolean): Promise<string>
    marks(file: string): Promise<GitMarks>
    op(root: string, op: GitOp, hash: string, arg?: string, isMerge?: boolean): Promise<string>
    log(root: string, limit: number): Promise<GitCommit[]>
    pull(root: string): Promise<string>
    fetch(root: string): Promise<string>
    suggestCommit(root: string): Promise<McpResult & { agent?: string }>
    onCommitAgent(cb: (name: string) => void): () => void
    show(root: string, rev: string, path: string): Promise<string | null>
    commitFiles(root: string, hash: string, parent: string | null): Promise<GitChangedFile[]>
  }
  agents: {
    detect(): Promise<AgentInfo[]>
    shell(): Promise<string>
    candidates(): Promise<AgentCandidate[]>
    addCustom(name: string, commandLine: string): Promise<McpResult>
    removeCustom(command: string): Promise<void>
  }
  update: {
    state(): Promise<UpdateState>
    check(): Promise<void>
    install(): Promise<void>
    version(): Promise<string>
    onState(cb: (state: UpdateState) => void): () => void
  }
  usage: {
    collect(project: string | null, fetchLimits: boolean): Promise<UsageData>
    rename(session: SessionInfo, name: string): Promise<void>
    remove(session: SessionInfo): Promise<McpResult>
    names(): Promise<Record<string, string>>
  }
  mcp: {
    list(project: string | null): Promise<McpServer[]>
    app(): Promise<AppMcpInfo>
    registry(query: string, cursor: string): Promise<RegistryPage>
    featured(): Promise<RegistryServer[]>
    add(agent: McpAgent, spec: McpSpec, scope: McpScope, project: string | null): Promise<McpResult>
    probe(server: McpServer, project: string | null): Promise<McpProbe>          // arranca o llama al servidor y pide sus herramientas
    update(server: McpServer, spec: McpSpec, project: string | null): Promise<McpResult>   // cambia un servidor en su agente y alcance
    disable(server: McpServer, project: string | null): Promise<McpResult>       // lo quita del agente y se apunta cómo estaba
    enable(server: McpServer, project: string | null): Promise<McpResult>
    remove(server: McpServer, project: string | null): Promise<McpResult>        // lo borra del agente (o lo olvida, si estaba desactivado)
    sync: {
      state(project: string | null, scope: SyncScope): Promise<SyncState>
      apply(project: string | null, scope: SyncScope): Promise<McpResult>      // añade a cada agente lo que le falta de la fuente
      standardize(project: string): Promise<McpResult>                         // pasa los MCP locales a .mcp.json y limpia opencode.json
      pull(project: string | null, scope: SyncScope): Promise<McpResult>       // trae a la fuente lo que solo está en otros agentes
      resolve(project: string | null, scope: SyncScope, name: string, agent: McpAgent, use: 'source' | 'agent'): Promise<McpResult>
    }
  }
  orchestra: {
    newId(): Promise<string>
    onOpenPane(cb: (pane: OpenPane) => void): () => void
    tasks(): Promise<TaskInfo[]>
    clearTasks(): Promise<void>
    onToast(cb: (message: string, kind: 'ok' | 'error' | 'info') => void): () => void
  }
  pty: {
    spawn(opts: PtyOptions): Promise<{ ok: boolean; error?: string }>
    write(id: string, data: string): void
    paste(id: string, text: string): void      // escribe en el prompt sin enviarlo
    resize(id: string, cols: number, rows: number): void
    kill(id: string): void
    onData(cb: (id: string, data: string) => void): () => void
    onExit(cb: (e: PtyExit) => void): () => void
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    openNew(): void
    isEmpty(): Promise<boolean>
    onMaximized(cb: (maximized: boolean) => void): () => void
  }
}

/** Búsqueda en el proyecto (panel «Buscar»). */
export interface SearchOptions { query: string; caseSensitive: boolean; wholeWord: boolean; regex: boolean; include?: string; exclude?: string }
/** `col` es la columna en la línea original; `text` es un trozo de la línea que empieza en `offset`. */
export interface SearchMatch { line: number; col: number; length: number; text: string; offset: number }
export interface SearchFile { path: string; rel: string; matches: SearchMatch[] }
export interface SearchResult { files: SearchFile[]; total: number; truncated: boolean; error?: string }
export interface ReplaceResult { files: number; count: number; error?: string }
