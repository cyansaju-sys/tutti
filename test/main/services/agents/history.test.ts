import { describe, expect, it } from 'vitest'
import { historyPenalty, pickAgent, type Candidate } from '../../../../src/main/services/agents/assign'
import { addOutcome, historyKey } from '../../../../src/main/services/agents/history'

describe('historial de agentes', () => {
  it('anota aciertos y fallos por agente, modelo y dificultad sin tocar el original', () => {
    const empty = {}
    const one = addOutcome(empty, historyKey('codex', 'gpt-5'), 'hard', false)
    const two = addOutcome(one, historyKey('codex', 'gpt-5'), 'hard', true)
    expect(empty).toEqual({})
    expect(two).toEqual({ 'codex|gpt-5': { hard: { ok: 1, fail: 1 } } })
    expect(historyKey('claude', null)).toBe('claude|')
  })
  it('sin bastantes tareas no penaliza; con muchas fallidas, sí', () => {
    expect(historyPenalty({ history: { hard: { ok: 0, fail: 2 } } }, 'hard')).toBe(0)
    expect(historyPenalty({ history: { hard: { ok: 0, fail: 4 } } }, 'hard')).toBe(40)
    expect(historyPenalty({ history: { hard: { ok: 3, fail: 1 } } }, 'hard')).toBe(10)
    expect(historyPenalty({ history: { hard: { ok: 0, fail: 9 } } }, 'easy')).toBe(0)
  })
  it('entre dos agentes iguales, el reparto elige al que suele acertar en esa dificultad', () => {
    const a: Candidate = { id: 'a2', name: 'A', command: 'a', tier: 'advanced', busy: false, history: { hard: { ok: 1, fail: 5 } } }
    const b: Candidate = { id: 'a3', name: 'B', command: 'b', tier: 'advanced', busy: false, history: { hard: { ok: 5, fail: 0 } } }
    expect(pickAgent([a, b], 'hard').chosen?.id).toBe('a3')
    expect(pickAgent([a, b], 'easy').chosen?.id).toBe('a2')          // en lo fácil no hay historial: gana el primero
  })
})
