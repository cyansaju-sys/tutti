/**
 * Historial de cada agente y modelo: cuántas tareas de cada dificultad terminó bien y cuántas falló (o se le rechazaron).
 * El reparto lo usa para evitar a quien suele fallar en una dificultad. Se guarda en los ajustes (`agent_history`), no por proyecto.
 */
import type { Difficulty } from './assign'
import { getSetting, setSetting } from '../settings'

export interface Outcomes { ok: number; fail: number }
export type TrackRecord = Partial<Record<Difficulty, Outcomes>>
type History = Record<string, TrackRecord>

const KEY = 'agent_history'
/** Agente y modelo: el mismo agente con otro modelo es otro historial. */
export const historyKey = (command: string, model: string | null | undefined): string => `${command}|${model ?? ''}`

/** El historial con una tarea más anotada (sin tocar el original). */
export function addOutcome(history: History, key: string, d: Difficulty, ok: boolean): History {
  const prev = history[key]?.[d] ?? { ok: 0, fail: 0 }
  return { ...history, [key]: { ...history[key], [d]: ok ? { ...prev, ok: prev.ok + 1 } : { ...prev, fail: prev.fail + 1 } } }
}

const load = (): History => {
  const raw = getSetting(KEY)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as History : {}
}

/** Anota cómo acabó una tarea de un agente y modelo. */
export function recordOutcome(command: string, model: string | null | undefined, d: Difficulty, ok: boolean): void {
  setSetting(KEY, addOutcome(load(), historyKey(command, model), d, ok))
}

/** El historial de un agente y modelo; vacío si nunca hizo nada. */
export const trackRecord = (command: string, model: string | null | undefined): TrackRecord => load()[historyKey(command, model)] ?? {}
