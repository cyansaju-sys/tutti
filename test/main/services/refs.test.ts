import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { attachRefs, listRefs, previewRefs } from '../../../src/main/services/refs'

const project = mkdtempSync(join(tmpdir(), 'refs-'))
mkdirSync(join(project, 'src', 'lib'), { recursive: true })
mkdirSync(join(project, 'node_modules', 'x'), { recursive: true })
writeFileSync(join(project, 'src', 'a.ts'), 'export const a = 1\n')
writeFileSync(join(project, 'src', 'lib', 'b.ts'), 'export const b = 2\n')
writeFileSync(join(project, 'node_modules', 'x', 'i.js'), 'x')
writeFileSync(join(project, 'bin.dat'), Buffer.from([0, 1, 2]))

describe('#archivo y #carpeta', () => {
  it('lista archivos y carpetas del proyecto, sin lo generado', async () => {
    const refs = await listRefs(project)
    expect(refs.filter((r) => r.isDir).map((r) => r.path)).toEqual(['src/', 'src/lib/'])
    expect(refs.filter((r) => !r.isDir).map((r) => r.path)).toEqual(['bin.dat', 'src/a.ts', 'src/lib/b.ts'])
  })

  it('adjunta el contenido de un archivo y la lista de una carpeta', async () => {
    const out = await attachRefs(project, 'mira #src/a.ts y #src/')
    expect(out.startsWith('mira #src/a.ts y #src/')).toBe(true)
    expect(out).toContain('--- #src/a.ts (file) ---\nexport const a = 1')
    expect(out).toContain('--- #src/ (folder) ---\na.ts\nlib/\nlib/b.ts')
  })

  it('ignora lo que no existe o está fuera del proyecto, y no adjunta binarios', async () => {
    expect(await attachRefs(project, 'issue #123 y #../etc/passwd y #nada.md')).toBe('issue #123 y #../etc/passwd y #nada.md')
    expect(await attachRefs(project, 'ver #bin.dat')).toContain('binary file, not attached')
  })
})

describe('secretos', () => {
  it('no adjunta ni lista archivos con secretos', async () => {
    writeFileSync(join(project, '.env'), 'TOKEN=abc')
    const out = await attachRefs(project, 'mira #.env')
    expect(out).not.toContain('TOKEN=abc')
    expect(out).toContain('looks like it holds secrets')
    expect((await listRefs(project)).some((r) => r.path === '.env')).toBe(false)
  })
})

describe('vista previa de lo que se adjunta', () => {
  it('da el tamaño y el estado de cada referencia sin devolver el contenido', async () => {
    writeFileSync(join(project, '.env'), 'X=1')
    writeFileSync(join(project, 'big.txt'), 'x'.repeat(50_000))
    const preview = await previewRefs(project, 'a #src/a.ts b #big.txt c #bin.dat d #.env e #nada.md')
    expect(preview).toEqual([
      { token: 'src/a.ts', chars: 19, note: 'ok' }, { token: 'big.txt', chars: 40_000, note: 'truncated' },
      { token: 'bin.dat', chars: 0, note: 'binary' }, { token: '.env', chars: 0, note: 'blocked' }
    ])
  })
})
