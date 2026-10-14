/** Entorno con el que se arranca un agente en una terminal. */
import { extendedPath } from '../../utils/shellpath'

/** Variables de una sesión de Claude Code que no deben heredar los agentes que se abren desde Tutti. */
const SESSION_VARS = [
  'CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_EXECPATH', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_AGENT_SDK_VERSION', 'CLAUDE_PID'
]

/** Entorno del agente: sin variables de sesión ajenas y con el PATH ampliado. */
export function childEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !SESSION_VARS.includes(k) && !k.startsWith('ELECTRON_')) env[k] = v
  env.PATH = extendedPath()
  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  return { ...env, ...extra }
}
