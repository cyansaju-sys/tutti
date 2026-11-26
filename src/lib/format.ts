import { t } from './i18n'

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`
  return String(n)
}

/** Duración corta: «5 min», «2 h 05 min», «3 d» (las abreviaturas valen en los dos idiomas). */
export function fmtDelta(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  if (minutes >= 24 * 60) return `${Math.floor(minutes / (24 * 60))} d`
  if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
  return `${minutes} min`
}

export const ago = (ms: number, now = Date.now()): string => (now - ms < 90_000 ? t('time.now') : t('time.ago', { delta: fmtDelta(now - ms) }))

/** Color de una barra de uso según lo cerca que esté del límite. */
export const severity = (percent: number): 'danger' | 'warn' | 'accent' => (percent >= 85 ? 'danger' : percent >= 60 ? 'warn' : 'accent')

export const resumeArgs = (command: string, id: string): string[] | null =>
  command === 'claude' ? ['--resume', id] : command === 'codex' ? ['resume', id] : command === 'opencode' ? ['--session', id] : command === 'agy' ? ['--conversation', id] : null

/** Hace cuánto, en corto: «now», «45m», «23h», «4d». */
export const short = (ms: number, now: number, nowLabel: string): string => {
  const d = now - ms
  if (d < 90_000) return nowLabel
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`
  return `${Math.floor(d / 86_400_000)}d`
}

/** Cuánto dura algo, en corto: «0m», «45m», «2h05», «3d». */
export const elapsed = (ms: number): string => {
  const m = Math.max(0, Math.floor(ms / 60_000))
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
  return `${Math.floor(m / 1440)}d`
}
