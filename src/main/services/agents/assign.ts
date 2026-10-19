/** Reparto de tareas según la capacidad: qué agente conviene a una dificultad dada. Funciones puras, sin tocar la app. */
import type { Tier } from './models'
import { tm } from '../../utils/i18n'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Candidate {
  /** Id del panel si ya está abierto; sin id = habría que abrirlo. */
  id?: string
  name: string
  command: string
  tier: Tier
  busy: boolean
  /** Porcentaje usado del límite más ajustado (0-100); undefined si no se conoce. */
  quota?: number
  /** Cuántas tareas de cada dificultad terminó bien y cuántas falló (ver history.ts). */
  history?: Partial<Record<Difficulty, { ok: number; fail: number }>>
}

const LEVEL: Record<Tier, number> = { basic: 0, standard: 1, advanced: 2 }
/** Nivel mínimo que pide cada dificultad. */
export const REQUIRED: Record<Difficulty, Tier> = { easy: 'basic', medium: 'standard', hard: 'advanced' }
export const QUOTA_EXHAUSTED = 95        // por encima, el agente no se elige
const QUOTA_LOW = 80                     // por encima, se prefiere otro

export const isDifficulty = (v: unknown): v is Difficulty => v === 'easy' || v === 'medium' || v === 'hard'
export const capable = (c: Pick<Candidate, 'tier'>, d: Difficulty): boolean => LEVEL[c.tier] >= LEVEL[REQUIRED[d]]
export const exhausted = (c: Pick<Candidate, 'quota'>): boolean => (c.quota ?? 0) >= QUOTA_EXHAUSTED

/** Qué dificultades puede asumir un agente (para mostrarlo en list_agents). */
export const capableFor = (c: Pick<Candidate, 'tier'>): Difficulty[] => (['easy', 'medium', 'hard'] as const).filter((d) => capable(c, d))

export const MIN_HISTORY = 3          // con menos tareas de esa dificultad, el historial aún no dice nada

/** Coste por historial: 0 si suele acertar en esa dificultad (o aún no hay datos), hasta 40 si casi siempre falla. */
export function historyPenalty(c: Pick<Candidate, 'history'>, d: Difficulty): number {
  const h = c.history?.[d]
  const n = h ? h.ok + h.fail : 0
  return h && n >= MIN_HISTORY ? Math.round((h.fail / n) * 40) : 0
}

/**
 * Menor es mejor: libre antes que ocupado, ya abierto antes que nuevo, el justo para la tarea antes que uno sobrado, con cuota antes que sin
 * ella y el que suele acertar en esa dificultad antes que el que suele fallar.
 */
function cost(c: Candidate, d: Difficulty): number {
  const spare = LEVEL[c.tier] - LEVEL[REQUIRED[d]]      // niveles de más: no se gasta un agente avanzado en algo fácil
  return (c.busy ? 100 : 0) + (c.id ? 0 : 10) + Math.max(0, spare) * 5 + ((c.quota ?? 0) >= QUOTA_LOW ? 30 : 0) + historyPenalty(c, d)
}

export interface Assignment<C extends Candidate = Candidate> { chosen: C | null; reason: string; ranking: C[] }

/** Elige el mejor agente para la dificultad. Si ninguno llega al nivel pedido, devuelve el más capaz y lo avisa. */
export function pickAgent<C extends Candidate>(candidates: C[], d: Difficulty): Assignment<C> {
  const usable = candidates.filter((c) => !exhausted(c))
  const enough = usable.filter((c) => capable(c, d)).sort((a, b) => cost(a, d) - cost(b, d))
  if (enough.length) return { chosen: enough[0], ranking: enough, reason: tm('m.assign.enough', { tier: enough[0].tier, d }) }
  const best = [...usable].sort((a, b) => LEVEL[b.tier] - LEVEL[a.tier] || cost(a, d) - cost(b, d))
  if (best.length) return { chosen: best[0], ranking: best, reason: tm('m.assign.none', { required: REQUIRED[d], tier: best[0].tier }) }
  return { chosen: null, ranking: [], reason: candidates.length ? tm('m.assign.exhausted') : tm('m.assign.unavailable') }
}
