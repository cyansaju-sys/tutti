import { describe, expect, it } from 'vitest'
import { parseCodexRollout, windowLabel } from '../../../../src/main/services/usage/codexDb'

const line = (o: unknown): string => JSON.stringify(o)
const count = (ts: string, total: { input_tokens: number; cached_input_tokens: number; output_tokens: number }, rl?: unknown): string =>
  line({ timestamp: ts, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: total }, rate_limits: rl } })

const rollout = [
  line({ timestamp: '2026-10-10T10:00:00.000Z', type: 'session_meta', payload: { id: 'abc-123', timestamp: '2026-10-10T09:59:50.000Z', cwd: '/tmp/proyecto' } }),
  line({ timestamp: '2026-10-10T10:00:01.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>nada</environment_context>' }] } }),
  line({ timestamp: '2026-10-10T10:00:02.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Haz una app\nde tareas' }] } }),
  count('2026-10-10T10:01:00.000Z', { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50 },
    { primary: { used_percent: 2, window_minutes: 43200, resets_at: 1794236710 }, secondary: null }),
  count('2026-10-10T10:01:00.500Z', { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50 }),            // aviso repetido: no suma
  count('2026-10-10T10:02:00.000Z', { input_tokens: 3000, cached_input_tokens: 2500, output_tokens: 150 }),
  'una línea rota {'
].join('\n')

describe('registros de Codex', () => {
  it('lee la sesión, su primera frase y los tokens procesados', () => {
    const f = parseCodexRollout(rollout)!
    expect(f.id).toBe('abc-123')
    expect(f.cwd).toBe('/tmp/proyecto')
    expect(f.firstPrompt).toBe('Haz una app de tareas')            // salta las instrucciones que mete la herramienta
    expect(f.events.map((e) => e.tokens)).toEqual([250, 400])      // (entrada − caché) + salida, por diferencias
    expect(f.end).toBe(Date.parse('2026-10-10T10:02:00.000Z'))
  })

  it('toma los límites del último aviso que los trae', () => {
    const f = parseCodexRollout(rollout)!
    expect(f.limits).toEqual([{ percent: 2, windowMinutes: 43200, resetsAt: 1794236710 * 1000 }])
  })

  it('un archivo sin sesión no cuenta', () => {
    expect(parseCodexRollout('{"type":"turn_context"}\nbasura')).toBeNull()
  })

  it('nombra la ventana del límite', () => {
    expect(windowLabel(43200)).toBe('30 días')
    expect(windowLabel(10080)).toBe('7 días')
    expect(windowLabel(300)).toBe('5 h')
    expect(windowLabel(45)).toBe('45 min')
  })
})
