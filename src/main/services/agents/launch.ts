/** Cómo arrancar cada agente conectado al reparto de tareas (argumentos y variables de entorno). */
import type { McpSpec } from '../../../shared/types'

export interface McpEntry { type: 'http'; url: string; headers: Record<string, string> }
/** Contexto para los agentes: el texto (global y del proyecto juntos) y los archivos donde vive cada parte. */
export interface ProjectContext { text: string; files: string[] }
/** Los MCP del `.mcp.json` del proyecto que OpenCode recibe al arrancar, en lugar de un `opencode.json` con lo mismo. */
export type ProjectServers = McpSpec[]
export interface Launch { args: string[]; env: Record<string, string>; after?: () => void }

// herramientas del servidor «tutti» que Claude Code puede usar sin pedir permiso cada vez
export const TUTTI_TOOLS = ['mcp__tutti__list_agents', 'mcp__tutti__delegate_task', 'mcp__tutti__wait_agent', 'mcp__tutti__read_agent_output', 'mcp__tutti__report_done', 'mcp__tutti__get_role_result',
  'mcp__tutti__ask_leader', 'mcp__tutti__answer_agent', 'mcp__tutti__post_note', 'mcp__tutti__read_notes', 'mcp__tutti__get_updates', 'mcp__tutti__list_role_templates', 'mcp__tutti__list_powers', 'mcp__tutti__use_power']
// cómo arrancar cada agente con una tarea inicial (el resto la recibe escrita cuando ya está listo)
export const PROMPT_ARGS: Record<string, (text: string) => string[]> = {
  claude: (t) => [t], opencode: (t) => ['--prompt', t],
  agy: (t) => ['--prompt-interactive', t]            // Antigravity: ejecuta la tarea y sigue en modo interactivo
}

/** OpenCode lee las instrucciones adicionales de la clave `instructions` (rutas de archivos). */
const instructions = (context?: ProjectContext): { instructions?: string[] } => (context ? { instructions: context.files } : {})

/**
 * OpenCode 2.x atiende a todos sus clientes desde UN servicio en segundo plano compartido: la configuración que se le pasa
 * a un proceso por variable de entorno se pierde si el servicio ya estaba corriendo, y la que consigue entrar queda para
 * todos los demás OpenCode (incluidos los que abres fuera de Tutti). `--standalone` le da a cada panel su propio servidor
 * privado: la configuración (con el id de ese panel) se aplica solo a él y no deja nada atrás.
 * La 1.x no tiene servicio compartido ni ese flag, y declara los servidores directamente bajo `mcp`.
 */
export function opencodeLaunch(entry: McpEntry | null, first: string[], given: string[], major: number, context?: ProjectContext, project: ProjectServers = []): Launch {
  const mine = project.map((s): [string, unknown] => [s.name, s.kind === 'remote'
    ? { type: 'remote', url: s.url, headers: s.headers ?? {} }
    : { type: 'local', command: [s.command, ...(s.args ?? [])], environment: s.env ?? {} }])
  if (!entry && !mine.length) {         // sin servidor de reparto de tareas ni MCP del proyecto: solo el contexto
    return { args: [...first, ...given], env: context ? { OPENCODE_CONFIG_CONTENT: JSON.stringify(instructions(context)) } : {} }
  }
  const servers = Object.fromEntries([...mine, ...(entry ? [['tutti', { type: 'remote', url: entry.url, headers: entry.headers }] as [string, unknown]] : [])])
  if (major >= 2) {
    const config = { mcp: { servers }, ...(entry ? { permission: { 'tutti_*': 'allow' } } : {}), ...instructions(context) }   // sin preguntar en cada llamada
    return { args: ['--standalone', ...first, ...given], env: { OPENCODE_CONFIG_CONTENT: JSON.stringify(config) } }
  }
  return { args: [...first, ...given], env: { OPENCODE_CONFIG_CONTENT: JSON.stringify({ mcp: servers, ...instructions(context) }) } }
}

/** La tarea inicial va primero: --mcp-config acepta varios valores y se la comería. */
export function claudeLaunch(entry: McpEntry | null, first: string[], given: string[], context?: ProjectContext): Launch {
  const system = context ? ['--append-system-prompt', context.text] : []
  if (!entry) return { args: [...first, ...given, ...system], env: {} }
  return { args: [...first, ...given, ...system, '--mcp-config', JSON.stringify({ mcpServers: { tutti: entry } }), '--allowedTools', ...TUTTI_TOOLS], env: {} }
}

/**
 * Codex acepta `-c clave=valor` para sobrescribir su config.toml solo en ese proceso: la URL va en el argumento y la clave
 * por variable de entorno (`bearer_token_env_var`), así no se escribe nada en ~/.codex ni queda para otros Codex.
 */
export function codexLaunch(entry: McpEntry, given: string[]): Launch {
  const conf = (key: string, value: string): string[] => ['-c', `mcp_servers.tutti.${key}=${JSON.stringify(value)}`]
  const token = (entry.headers.Authorization ?? '').replace(/^Bearer\s+/i, '')
  return { args: [...conf('url', entry.url), ...conf('bearer_token_env_var', 'TUTTI_MCP_TOKEN'), ...conf('default_tools_approval_mode', 'approve'), ...given], env: { TUTTI_MCP_TOKEN: token } }
}

export function buildLaunch(command: string, entry: McpEntry | null, prompt: string | undefined, given: string[], opencodeMajor: number, context?: ProjectContext, project?: ProjectServers): Launch {
  const task = prompt?.trim()
  const first = task && PROMPT_ARGS[command] ? PROMPT_ARGS[command](task) : []
  if (command === 'claude') return claudeLaunch(entry, first, given, context)
  if (command === 'opencode') return opencodeLaunch(entry, first, given, opencodeMajor, context, project)
  if (command === 'codex' && entry) return codexLaunch(entry, given)
  // la tarea inicial va primero también aquí: deliverTask da por entregada la de los agentes con PROMPT_ARGS, y sin ella arrancarían sin nada que hacer
  if (command === 'agy' && entry) return { args: [...first, ...given], env: agyEnv(entry) }
  return { args: [...first, ...given], env: {} }
}

/** Antigravity recibe la URL y la clave de su sesión por entorno; el puente que registra Tutti (agyBridge) las lee. */
export const agyEnv = (entry: McpEntry): Record<string, string> => ({ TUTTI_MCP_URL: entry.url, TUTTI_MCP_AUTH: entry.headers.Authorization ?? '' })

/** Deja solo letras y números: así el texto se reconoce aunque la pantalla lo parta en líneas o lo rodee de bordes. */
const squash = (t: string): string => t.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()

/** ¿Aparece el comienzo de la tarea en la pantalla del agente? (si no, no la recibió) */
export function taskShown(screen: string, task: string): boolean {
  const head = squash(task).slice(0, 30)
  return head.length === 0 || squash(screen).includes(head)
}

// avisos con los que los agentes piden permiso o una respuesta antes de seguir (Claude, Codex, OpenCode, Gemini, Aider…)
const ASKING = /(do you want to (proceed|make this edit|create|run|allow)|allow (once|always|execution|this|command)|permission (required|needed)|approve (this|command|edit)|waiting for (your )?(approval|confirmation|input)|press enter to continue|\(y\/n\)|\[y\/n\]|\(yes\/no\)|¿(quieres|deseas|permitir)|permitir (una vez|siempre))/i
const ASKING_ROWS = 15

/** ¿El agente está parado esperando a que alguien le responda (un permiso, una confirmación)? Solo mira el final de la pantalla. */
export function awaitingInput(screen: string): boolean {
  return ASKING.test(screen.split('\n').slice(-ASKING_ROWS).join('\n'))
}

/** «opencode v2.0.21» -> 2. Si no se puede leer se asume la versión actual (2). */
export function parseMajor(output: string): number {
  const m = /(\d+)\.\d+/.exec(output)
  return m ? Number(m[1]) : 2
}
