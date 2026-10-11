/**
 * Historial y consumo de Codex, leídos de sus registros locales: ~/.codex/sessions/AAAA/MM/DD/rollout-*.jsonl (una sesión por
 * archivo) y ~/.codex/session_index.jsonl (los nombres de las conversaciones). Cada aviso `token_count` lleva los tokens
 * acumulados de la sesión y, en `rate_limits`, el porcentaje usado de los límites de su plan.
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { tm } from '../i18n'
import type { LimitInfo, SessionInfo } from '../../shared/types'

const root = (): string => process.env.CODEX_HOME || join(homedir(), '.codex')
const HOUR = 3_600_000

export interface CodexLimit { percent: number; windowMinutes: number; resetsAt: number }
export interface CodexFile {
  id: string; cwd: string; start: number; end: number; firstPrompt: string
  events: Array<{ ts: number; tokens: number }>          // tokens nuevos de cada aviso (la diferencia con el anterior)
  limits: CodexLimit[]; limitsAt: number                  // los de su último aviso
}

type Raw = Record<string, any>   // eslint-disable-line @typescript-eslint/no-explicit-any
/** Tokens de verdad procesados: la entrada que no vino de la caché más lo que generó. */
const processed = (u: Raw | undefined): number => (u ? Math.max(0, (u.input_tokens ?? 0) - (u.cached_input_tokens ?? 0)) + (u.output_tokens ?? 0) : 0)

/** Primer mensaje del usuario, si es texto suyo y no instrucciones que mete la propia herramienta (empiezan por «<»). */
function promptOf(payload: Raw): string {
  if (payload.type !== 'message' || payload.role !== 'user') return ''
  for (const part of Array.isArray(payload.content) ? payload.content : []) {
    const text = typeof part?.text === 'string' ? part.text.trim() : ''
    if (text && !text.startsWith('<')) return text.replace(/\s+/g, ' ').slice(0, 90)
  }
  return ''
}

export function parseCodexRollout(text: string): CodexFile | null {
  let id = '', cwd = '', start = 0, end = 0, firstPrompt = '', prev = 0, limitsAt = 0
  const events: CodexFile['events'] = []
  let limits: CodexLimit[] = []
  for (const line of text.split('\n')) {
    if (!line) continue
    let d: Raw
    try { d = JSON.parse(line) } catch { continue }
    const ts = Date.parse(d.timestamp ?? '') || 0
    if (ts) end = Math.max(end, ts)
    const p: Raw = d.payload ?? {}
    if (d.type === 'session_meta') { id ||= p.id ?? ''; cwd ||= p.cwd ?? ''; start ||= Date.parse(p.timestamp ?? '') || ts }
    else if (d.type === 'response_item') firstPrompt ||= promptOf(p)
    else if (d.type === 'event_msg' && p.type === 'token_count') {
      const total = processed(p.info?.total_token_usage)
      if (total > prev) { events.push({ ts, tokens: total - prev }); prev = total }
      const rl: Raw | undefined = p.rate_limits
      if (rl && ts >= limitsAt) {
        const found = [rl.primary, rl.secondary].filter((w): w is Raw => !!w && typeof w.used_percent === 'number' && !!w.resets_at)
        if (found.length) { limits = found.map((w) => ({ percent: w.used_percent, windowMinutes: w.window_minutes ?? 0, resetsAt: w.resets_at * 1000 })); limitsAt = ts }
      }
    }
  }
  return id ? { id, cwd, start: start || end, end, firstPrompt, events, limits, limitsAt } : null
}

const cache = new Map<string, { stamp: string; data: CodexFile | null }>()
const files = (): string[] => {
  const out: string[] = []
  const walk = (dir: string, depth: number): void => {
    let names: string[] = []
    try { names = readdirSync(dir) } catch { return }
    for (const name of names) {
      const path = join(dir, name)
      if (depth < 3) walk(path, depth + 1)                                       // AAAA / MM / DD
      else if (name.startsWith('rollout-') && name.endsWith('.jsonl')) out.push(path)
    }
  }
  walk(join(root(), 'sessions'), 0)
  return out
}

/** Nombres de las conversaciones: id -> nombre (session_index.jsonl). */
function threadNames(): Map<string, string> {
  const names = new Map<string, string>()
  try {
    for (const line of readFileSync(join(root(), 'session_index.jsonl'), 'utf8').split('\n')) {
      if (!line) continue
      try { const d = JSON.parse(line) as Raw; if (d.id && d.thread_name) names.set(d.id, String(d.thread_name)) } catch { /* línea rota */ }
    }
  } catch { /* sin índice */ }
  return names
}

/** «43200» -> «30 días», «300» -> «5 h». */
export function windowLabel(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return tm('m.us.dayWord', { n: minutes / 1440 })
  if (minutes >= 60) return `${Math.round(minutes / 60)} h`
  return `${minutes} min`
}

export interface CodexData {
  sessions: SessionInfo[]
  usage: { today: number; week: number; total: number }
  limits: LimitInfo[]; limitsAge: number
}

/** null si Codex no tiene carpeta de sesiones (no está instalado o nunca se usó). */
export function readCodexData(now: number): CodexData | null {
  if (!existsSync(join(root(), 'sessions'))) return null
  const parsed: CodexFile[] = []
  for (const path of files()) {
    try {
      const st = statSync(path)
      const stamp = `${st.mtimeMs}:${st.size}`
      let hit = cache.get(path)
      if (!hit || hit.stamp !== stamp) { hit = { stamp, data: parseCodexRollout(readFileSync(path, 'utf8')) }; cache.set(path, hit) }
      if (hit.data) parsed.push(hit.data)
    } catch { /* archivo en uso o borrado */ }
  }
  const names = threadNames()
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const weekStart = now - 7 * 24 * HOUR
  let today = 0, week = 0, total = 0
  let newest: CodexFile | null = null
  const sessions: SessionInfo[] = []
  for (const f of parsed) {
    let tokens = 0
    for (const e of f.events) {
      tokens += e.tokens
      if (e.ts >= startOfToday) today += e.tokens
      if (e.ts >= weekStart) week += e.tokens
    }
    total += tokens
    if (f.limits.length && (!newest || f.limitsAt > newest.limitsAt)) newest = f
    sessions.push({ command: 'codex', agent: 'Codex', id: f.id, title: names.get(f.id) || f.firstPrompt || tm('m.us.untitled'), cwd: f.cwd,
      project: f.cwd ? basename(f.cwd) : '', tokens, start: f.start, end: f.end })
  }
  sessions.sort((a, b) => b.end - a.end)
  const limits = (newest?.limits ?? []).filter((l) => l.resetsAt > now).map((l) => ({ label: tm('m.us.codexWindow', { w: windowLabel(l.windowMinutes) }), percent: l.percent, resetsAt: l.resetsAt }))
  return { sessions, usage: { today, week, total }, limits, limitsAge: limits.length && newest ? Math.max(0, (now - newest.limitsAt) / 1000) : 0 }
}

/** Borra el archivo de la sesión y su nombre del índice. Devuelve false si no se encontró. */
export function deleteCodexSession(id: string): boolean {
  let removed = false
  for (const path of files()) {
    if (!basename(path).includes(id)) continue
    try { unlinkSync(path); cache.delete(path); removed = true } catch { /* en uso */ }
  }
  if (removed) {
    const index = join(root(), 'session_index.jsonl')
    try {
      const kept = readFileSync(index, 'utf8').split('\n').filter((l) => l && !l.includes(`"${id}"`))
      writeFileSync(index, kept.length ? kept.join('\n') + '\n' : '', 'utf8')
    } catch { /* sin índice */ }
  }
  return removed
}
