/**
 * Modelos de los agentes que solo los enseñan en su selector `/model` (Claude Code, Codex, Gemini CLI, Qwen Code, Copilot CLI): se abre
 * el agente en una terminal invisible en la carpeta del proyecto, se escribe /model, se lee la lista (bajando con la flecha para verla
 * entera) y se sale con Esc sin elegir nada.
 *
 * Nunca se pulsa Enter con el selector abierto (en Claude Code fijaría el modelo por defecto) y, si el agente pide antes confiar en la
 * carpeta o iniciar sesión, se cierra sin contestar: Tutti no acepta nada en nombre del usuario.
 */
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { which } from '../../utils/shellpath'
import { childEnv } from './env'

/** Cómo pasar la etiqueta que muestra cada agente al id que acepta su `--model`. */
const ID_OF: Record<string, (label: string) => string | null> = { claude: claudeId, codex: plainId, gemini: plainId, qwen: plainId, copilot: plainId }
export const canProbe = (command: string): boolean => command in ID_OF

/** «Opus 5.5» -> «claude-opus-5-5»; «Sonnet 5.5 (1M context)» -> «claude-sonnet-5-5[1m]». «Default» y lo que no es un modelo, null. */
export function claudeId(label: string): string | null {
  const m = /^(fable|opus|sonnet|haiku)\s+(\d+(?:\.\d+)?)(.*)$/i.exec(label.trim())
  if (!m) return null
  const id = `claude-${m[1].toLowerCase()}-${m[2].replace('.', '-')}`
  return /\b1m\b/i.test(m[3]) ? `${id}[1m]` : id
}

/** «GPT-5.6-Luna» -> «gpt-5.6-luna»; «gemini-2.5-pro» tal cual. «Default» o algo con espacios raros, null. */
export function plainId(label: string): string | null {
  const id = label.trim().toLowerCase().replace(/\s+/g, '-')
  return /^default\b/.test(id) || !/^[a-z0-9][\w.:/@+[\]-]*$/.test(id) ? null : id
}

const HEADER = /select\s+(a\s+)?model|choose\s+(a\s+)?model|switch\s+(between\s+)?\S*\s*models?/i
const ITEM = /^\s*(?:[❯›>▸▶●○◉◯↓↑]\s*)?(\d{1,2})[.)]\s+(.+?)\s*$/
const MARKS = /[✔✓●○◉◯]|\((?:current|recommended|default|actual|selected)\)/gi

/** Las opciones numeradas del selector de modelos en la pantalla (lo de debajo de su título), con su etiqueta limpia. */
export function parseModelList(screen: string): Array<{ n: number; label: string }> {
  const lines = screen.split('\n')
  let start = -1
  lines.forEach((l, i) => { if (HEADER.test(l)) start = i })
  if (start < 0) return []
  const out: Array<{ n: number; label: string }> = []
  for (const line of lines.slice(start + 1)) {
    const m = ITEM.exec(line)
    if (!m) continue
    const label = m[2].split(/\s{2,}/)[0].replace(MARKS, '').replace(/\s+/g, ' ').trim()
    if (label) out.push({ n: Number(m[1]), label })
  }
  return out
}

/** Ids de modelo (en el orden del selector) de las opciones vistas; `idOf` sin dar, el del agente. */
export function modelIds(command: string, items: Array<{ n: number; label: string }>): string[] {
  const idOf = ID_OF[command] ?? plainId
  const byNumber = new Map<number, string>()
  for (const { n, label } of items) if (!byNumber.has(n)) byNumber.set(n, label)
  const ids = [...byNumber.entries()].sort(([a], [b]) => a - b).map(([, label]) => idOf(label)).filter((id): id is string => !!id)
  return [...new Set(ids)]
}

/** Pantallas que piden una decisión antes de poder usar el agente: se cierra sin contestar. */
export const BLOCKING = /trust this folder|do you trust|trust the (files|contents)|work in this folder|sign in|log ?in to|login method|select login|api key|authenticate/i

const KEY = { down: '\x1b[B', downApp: '\x1bOB', esc: '\x1b' }
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Abre `command` en `cwd`, lee su selector /model y lo cierra. Devuelve los ids, o [] si no se pudo (no arranca, pide confiar en la
 * carpeta o iniciar sesión, no tiene /model o no respondió a tiempo).
 */
export async function probeModels(command: string, cwd: string, exe?: string): Promise<string[]> {
  if (!canProbe(command)) return []
  const file = exe && isAbsolute(exe) && existsSync(exe) ? exe : which(command)
  if (!file) return []
  // aquí y no arriba: las pruebas no cargan node-pty. Son CommonJS: según quién los cargue, lo exportado está en `default`
  const [ptyModule, headless] = await Promise.all([import('node-pty'), import('@xterm/headless')])
  const spawn = ptyModule.spawn ?? (ptyModule as unknown as { default: typeof ptyModule }).default.spawn
  const Terminal = headless.Terminal ?? (headless as unknown as { default: typeof headless }).default.Terminal
  const cols = 140, rows = 50
  const screen = new Terminal({ cols, rows, scrollback: 500, allowProposedApi: true })
  const win = process.platform === 'win32' && /\.(cmd|bat)$/i.test(file)
  let term: import('node-pty').IPty
  try {
    term = spawn(win ? 'cmd.exe' : file, win ? ['/c', file] : [], { name: 'xterm-256color', cols, rows, cwd, env: childEnv() })
  } catch { screen.dispose(); return [] }
  let last = Date.now()
  let exited = false
  term.onData((d) => { last = Date.now(); try { screen.write(d) } catch { /* ya liberada */ } })
  term.onExit(() => { exited = true })
  const text = (): string => {
    const b = screen.buffer.active
    const out: string[] = []
    for (let i = 0; i < b.length; i++) out.push(b.getLine(i)?.translateToString(true) ?? '')
    return out.join('\n')
  }
  /** Espera a que deje de pintar durante `quiet` ms (o a que pase `max`). */
  const settle = async (quiet: number, max: number): Promise<void> => {
    const t0 = Date.now()
    while (!exited && Date.now() - last < quiet && Date.now() - t0 < max) await sleep(100)
  }
  try {
    await settle(2500, 25_000)
    if (exited || BLOCKING.test(text())) return []
    term.write('/model')
    await sleep(600)
    term.write('\r')                                                // ejecuta el comando: abre el selector (aún no hay nada elegido)
    await settle(1500, 12_000)
    const seen = parseModelList(text())
    if (!seen.length) return []
    // bajar para ver las que no caben: la lista solo se desplaza cuando el cursor llega al final de lo visible, así que en cada ronda
    // se baja tantas veces como opciones hay a la vista; se para tras dos rondas sin nada nuevo (o si vuelve al principio)
    const count = (): number => new Set(seen.map((s) => s.n)).size
    for (let round = 0, stale = 0; round < 8 && stale < 2 && !exited; round++) {
      const before = count()
      for (let k = 0; k < Math.max(before, 3); k++) {             // una a una: Ink toma lo que llega junto como una sola tecla
        term.write(screen.modes.applicationCursorKeysMode ? KEY.downApp : KEY.down)
        await sleep(90)
        seen.push(...parseModelList(text()))                         // tras cada una: si la lista da la vuelta, no se pierde lo de en medio
      }
      await settle(300, 1500)
      seen.push(...parseModelList(text()))
      stale = count() > before ? 0 : stale + 1
    }
    return modelIds(command, seen)
  } finally {
    try { term.write(KEY.esc); await sleep(300); term.write(KEY.esc); await sleep(300) } catch { /* ya salió */ }
    try { term.kill() } catch { /* ya salió */ }
    try { screen.dispose() } catch { /* ya liberada */ }
  }
}
