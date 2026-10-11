import { describe, expect, it } from 'vitest'
import { applyHunks, textHunks } from '../../src/renderer/src/lib/textHunks'

describe('tramos de cambios externos', () => {
  it('separa cambios y aplica solo los aceptados', () => {
    const before = 'uno\ndos\ntres\ncuatro'
    const after = 'uno\nDOS\ntres\nCUATRO\ncinco'
    const hunks = textHunks(before, after)
    expect(hunks).toHaveLength(2)
    expect(applyHunks(before, hunks, new Set([0]))).toBe('uno\nDOS\ntres\ncuatro')
    expect(applyHunks(before, hunks, new Set([1]))).toBe('uno\ndos\ntres\nCUATRO\ncinco')
  })
})
