import { describe, expect, it } from 'vitest'
import { agentsMdPrompt } from '../../../../src/renderer/src/features/tutti/lib/agentsMd'

describe('petición para rellenar AGENTS.md', () => {
  const have = { steering: ['product.md', 'tech.md'], skills: ['revisar'], docs: true, specs: true }
  it('manda escribir encima del bloque y remitir a .tutti sin copiar', () => {
    const p = agentsMdPrompt('es', have)
    expect(p).toContain('tutti:start')
    expect(p).toContain('ENCIMA')
    expect(p).toContain('.tutti/steering/ (product.md, tech.md)')
    expect(p).toContain('.tutti/skills/ (revisar)')
    expect(p).toContain('openspec/')
    expect(p).toContain('NO lo copies')
  })
  it('sin nada en .tutti no habla de copiar', () => {
    expect(agentsMdPrompt('es', { steering: [], skills: [], docs: false, specs: false })).not.toContain('NO lo copies')
  })
  it('en inglés', () => {
    expect(agentsMdPrompt('en', have)).toContain('ABOVE')
  })
})
