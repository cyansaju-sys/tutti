/**
 * Hooks al estilo de Kiro: archivos JSON en .tutti/hooks/ que reaccionan a eventos del proyecto.
 *   { "version": "v1", "hooks": [{ "name", "description", "trigger", "matcher", "action": { "type": "command" | "agent", ... }, "timeout", "enabled" }] }
 * Tutti ejecuta `PostFileSave` (un archivo del proyecto se guarda): `command` corre un comando en la raíz con el contexto en JSON por stdin, y
 * `agent` escribe un prompt en el agente abierto. `PreToolUse`, `PostToolUse` y `Stop` se leen y se muestran pero no se ejecutan (son eventos
 * internos de la sesión de cada agente). Como un hook ejecuta comandos del repositorio, solo corre en proyectos que el usuario ha autorizado.
 */
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs'
import { join, sep } from 'node:path'
import type { HookInfo } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { extendedPath } from '../../utils/shellpath'
import { getSetting, setSetting } from '../settings'

export const TRIGGERS = ['PostFileSave', 'PreToolUse', 'PostToolUse', 'Stop'] as const
const SUPPORTED = new Set<string>(['PostFileSave'])
const DEFAULT_TIMEOUT_S = 60
const QUIET_MS = 2500             // tras correr un hook sobre un archivo, se ignoran sus cambios un momento: así un hook que reescribe el archivo no se dispara a sí mismo
const DEBOUNCE_MS = 250
const IGNORED = ['.git', 'node_modules', '.tutti', 'out', 'dist', 'build', 'release', 'coverage', '.next', '__pycache__', '.venv']

export const hooksDir = (project: string): string => join(project, '.tutti', 'hooks')

/** Lee un archivo de hooks. Si no es válido devuelve una sola entrada con el error (así se ve en la lista qué falla). */
export function parseHookFile(file: string, text: string): HookInfo[] {
  const bad = (error: string): HookInfo[] => [{ file, name: file.split(/[\\/]/).pop() ?? file, description: '', trigger: '', matcher: '', actionType: '', enabled: false, supported: false, error }]
  let data: unknown
  try { data = JSON.parse(text) } catch { return bad(tm('m.hooks.badJson')) }
  const root = data as { version?: unknown; hooks?: unknown }
  if (!root || typeof root !== 'object' || root.version !== 'v1' || !Array.isArray(root.hooks)) return bad(tm('m.hooks.badShape'))
  return root.hooks.map((raw, i): HookInfo => {
    const h = (raw ?? {}) as Record<string, unknown>
    const name = typeof h.name === 'string' && h.name.trim() ? h.name.trim() : `#${i + 1}`
    const action = (h.action ?? {}) as Record<string, unknown>
    const type = action.type === 'command' || action.type === 'agent' ? action.type : ''
    const trigger = typeof h.trigger === 'string' ? h.trigger : ''
    let error = ''
    if (!(TRIGGERS as readonly string[]).includes(trigger)) error = tm('m.hooks.badTrigger', { trigger: trigger || '—' })
    else if (!type) error = tm('m.hooks.badAction')
    else if (type === 'command' && typeof action.command !== 'string') error = tm('m.hooks.noCommand')
    else if (type === 'agent' && typeof action.prompt !== 'string') error = tm('m.hooks.noPrompt')
    return {
      file, name, description: typeof h.description === 'string' ? h.description : '', trigger, matcher: typeof h.matcher === 'string' ? h.matcher : '',
      actionType: type, enabled: h.enabled !== false && !error, supported: SUPPORTED.has(trigger) && !error, ...(error && { error })
    }
  })
}

/** Los hooks de .tutti/hooks/*.json del proyecto, cada uno con su archivo. */
export function loadHooks(project: string): HookInfo[] {
  const dir = hooksDir(project)
  let names: string[] = []
  try { names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.json')).sort() } catch { return [] }
  return names.flatMap((n) => { try { return parseHookFile(join(dir, n), readFileSync(join(dir, n), 'utf8')) } catch { return [] } })
}

/** La parte ejecutable de un hook (lo que `HookInfo` no guarda): se relee del archivo al dispararse, así los cambios se notan sin reiniciar. */
interface Runnable { info: HookInfo; command?: string; prompt?: string; timeout: number }
function runnables(project: string): Runnable[] {
  const dir = hooksDir(project)
  let names: string[] = []
  try { names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.json')).sort() } catch { return [] }
  const out: Runnable[] = []
  for (const n of names) {
    const file = join(dir, n)
    let infos: HookInfo[] = []; let raw: { hooks?: Array<{ action?: { command?: string; prompt?: string }; timeout?: unknown }> } = {}
    try { const text = readFileSync(file, 'utf8'); infos = parseHookFile(file, text); raw = JSON.parse(text) } catch { continue }
    infos.forEach((info, i) => {
      const h = raw.hooks?.[i]
      const timeout = typeof h?.timeout === 'number' && h.timeout >= 0 ? h.timeout : DEFAULT_TIMEOUT_S
      if (h && !info.error) out.push({ info, command: h.action?.command, prompt: h.action?.prompt, timeout })
    })
  }
  return out
}

/** ¿El matcher (una expresión regular sobre la ruta relativa) acepta este archivo? Sin matcher, todos; una expresión inválida no acepta ninguno. */
export function matches(matcher: string, relPath: string): boolean {
  if (!matcher) return true
  try { return new RegExp(matcher).test(relPath.split(sep).join('/')) } catch { return false }
}

/** Evita que un hook se dispare a sí mismo: no corre a la vez sobre el mismo archivo ni justo después de terminar. */
export function createGuard(quietMs = QUIET_MS): { enter(key: string, now?: number): boolean; leave(key: string, now?: number): void } {
  const running = new Set<string>()
  const quietUntil = new Map<string, number>()
  return {
    enter(key, now = Date.now()) {
      if (running.has(key) || now < (quietUntil.get(key) ?? 0)) return false
      running.add(key); return true
    },
    leave(key, now = Date.now()) { running.delete(key); quietUntil.set(key, now + quietMs) }
  }
}

export interface HookResult { name: string; ok: boolean; message: string }
export interface HooksHost { notify: (r: HookResult) => void; sendToAgent: (prompt: string) => boolean }

export const isTrusted = (project: string): boolean => Array.isArray(getSetting('hooks_trusted')) && (getSetting('hooks_trusted') as string[]).includes(project)
export function setTrusted(project: string, on: boolean): void {
  const list = (Array.isArray(getSetting('hooks_trusted')) ? (getSetting('hooks_trusted') as string[]) : []).filter((p) => p !== project)
  setSetting('hooks_trusted', on ? [...list, project] : list)
}

function runCommand(project: string, hook: Runnable, rel: string, host: HooksHost, done: () => void): void {
  const child = execFile(hook.command!, { shell: true, cwd: project, timeout: hook.timeout * 1000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8',
    env: { ...process.env, PATH: extendedPath(), TUTTI_HOOK_FILE: rel, TUTTI_PROJECT: project } }, (err, _out, stderr) => {
    done()
    host.notify(err
      ? { name: hook.info.name, ok: false, message: tm('m.hooks.failed', { name: hook.info.name, error: ((stderr || err.message) as string).trim().split('\n').slice(-2).join(' ').slice(0, 200) }) }
      : { name: hook.info.name, ok: true, message: tm('m.hooks.done', { name: hook.info.name }) })
  })
  child.stdin?.on('error', () => undefined)
  child.stdin?.end(JSON.stringify({ hook: hook.info.name, trigger: 'PostFileSave', file: rel, path: join(project, rel), project }))
}

let watcher: FSWatcher | null = null
let watching = ''
export function stopHooks(): void { watcher?.close(); watcher = null; watching = '' }

/** Vigila el proyecto (si está autorizado) y dispara los hooks `PostFileSave` cuando un archivo cambia. */
export function startHooks(project: string, host: HooksHost): void {
  if (watching === project && watcher) return
  stopHooks()
  if (!isTrusted(project) || !existsSync(project)) return
  const guard = createGuard()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  try {
    watcher = watch(project, { recursive: true }, (_event, name) => {
      if (!name) return
      const rel = name.toString()
      if (rel.split(sep).some((part) => IGNORED.includes(part))) return
      clearTimeout(timers.get(rel))
      timers.set(rel, setTimeout(() => {
        timers.delete(rel)
        try { if (!statSync(join(project, rel)).isFile()) return } catch { return }          // borrado o carpeta: no cuenta como «guardar»
        for (const hook of runnables(project)) {
          if (!hook.info.enabled || hook.info.trigger !== 'PostFileSave' || !matches(hook.info.matcher, rel)) continue
          const key = `${hook.info.file}:${hook.info.name}:${rel}`
          if (!guard.enter(key)) continue
          if (hook.info.actionType === 'command') runCommand(project, hook, rel, host, () => guard.leave(key))
          else {
            const sent = host.sendToAgent(`${hook.prompt}\n\n(${tm('m.hooks.file')}: ${rel})`)
            host.notify({ name: hook.info.name, ok: sent, message: tm(sent ? 'm.hooks.sent' : 'm.hooks.noAgent', { name: hook.info.name }) })
            guard.leave(key)
          }
        }
      }, DEBOUNCE_MS))
    })
    watching = project
  } catch { watcher = null }          // sin soporte para vigilar de forma recursiva: los hooks no corren, pero la app sigue
}
