import { expect, it } from 'vitest'
import { blame } from '../../../../src/main/services/git/git'

it('blame de un archivo versionado', async () => {
  const b = await blame(`${process.cwd()}/CONTRIBUTING.md`)
  expect(b).not.toBeNull()
  expect(b!.lines.length).toBeGreaterThan(0)
  const c = b!.commits[b!.lines[0]]
  expect(c.author).not.toBe('')
  expect(c.time).toBeGreaterThan(0)
  expect(c.summary).not.toBe('')
})
