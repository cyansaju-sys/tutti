/**
 * Consumo de Kiro (kiro-cli), leído de sus registros locales: ~/.kiro/sessions/<espacio>/sess_<id>/messages.jsonl.
 * Solo lectura. Kiro no cuenta tokens: al terminar cada turno apunta lo que costó en créditos (mensaje `usage_summary`).
 * El límite mensual de créditos no está en el equipo (lo lleva la cuenta), así que aquí solo sale lo gastado.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = (): string => process.env.KIRO_HOME || join(homedir(), '.kiro')
const DAY = 86_400_000

/** Los créditos de cada turno de una sesión, con su hora. */
export function parseKiroMessages(text: string): Array<{ ts: number; credits: number }> {
  const out: Array<{ ts: number; credits: number }> = []
  for (const line of text.split('\n')) {
    if (!line.includes('usage_summary')) continue
    try {
      const d = JSON.parse(line) as { timestamp?: string; payload?: { type?: string; promptTurnSummaries?: Array<{ unit?: string; usage?: number }> } }
      if (d.payload?.type !== 'usage_summary') continue
      const credits = (d.payload.promptTurnSummaries ?? []).reduce((n, s) => n + (s.unit === 'credit' && typeof s.usage === 'number' ? s.usage : 0), 0)
      const ts = Date.parse(d.timestamp ?? '')
      if (credits > 0 && ts) out.push({ ts, credits })
    } catch { /* línea rota */ }
  }
  return out
}

const cache = new Map<string, { stamp: string; turns: ReturnType<typeof parseKiroMessages> }>()      // ruta -> turnos (se relee solo si cambió)

/** Créditos gastados hoy, en los últimos 7 días y en total; null si Kiro no tiene carpeta de sesiones (no está instalado o nunca se usó). */
export function readKiroUsage(now: number): { today: number; week: number; total: number; sessions: number } | null {
  let spaces: string[]
  try { spaces = readdirSync(join(root(), 'sessions')) } catch { return null }
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  let today = 0, week = 0, total = 0, sessions = 0
  for (const space of spaces) {
    let names: string[] = []
    try { names = readdirSync(join(root(), 'sessions', space)) } catch { continue }          // «cli» guarda archivos sueltos, no sesiones
    for (const name of names) {
      if (!name.startsWith('sess_')) continue
      const file = join(root(), 'sessions', space, name, 'messages.jsonl')
      try {
        const st = statSync(file)
        const stamp = `${st.mtimeMs}:${st.size}`
        let hit = cache.get(file)
        if (hit?.stamp !== stamp) { hit = { stamp, turns: parseKiroMessages(readFileSync(file, 'utf8')) }; cache.set(file, hit) }
        sessions++
        for (const t of hit.turns) {
          total += t.credits
          if (t.ts >= startOfToday) today += t.credits
          if (t.ts >= now - 7 * DAY) week += t.credits
        }
      } catch { /* sesión sin mensajes */ }
    }
  }
  return { today, week, total, sessions }
}
