import { describe, expect, it } from 'vitest'
import { chatPrompt } from '../../../src/main/services/chat'

describe('prompt del chat', () => {
  it('los turnos anteriores conservan lo que citaron, pero solo los más recientes', () => {
    const history = [1, 2, 3, 4, 5].flatMap((n) => [
      { role: 'user' as const, text: `pregunta ${n}`, attached: `\n\nADJUNTO-${n}` }, { role: 'assistant' as const, text: `respuesta ${n}` }
    ])
    const prompt = chatPrompt(history)
    expect(prompt).toContain('ADJUNTO-5')
    expect(prompt).toContain('ADJUNTO-3')
    expect(prompt).not.toContain('ADJUNTO-2')
    expect(prompt).toContain('pregunta 1')          // el texto de la pregunta siempre está
  })
})
