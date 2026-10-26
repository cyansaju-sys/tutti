import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listRefs, resolve } from '../../../src/main/services/chatRefs'

const project = mkdtempSync(join(tmpdir(), 'chatrefs-'))
const git = (...args: string[]): string => execFileSync('git', ['-C', project, ...args], { encoding: 'utf8' })
git('init', '-q', '-b', 'master')
git('config', 'user.email', 't@t.t'); git('config', 'user.name', 'T')
writeFileSync(join(project, 'a.ts'), 'one\ntwo\nthree\n')
git('add', '.'); git('commit', '-q', '-m', 'primero')
mkdirSync(join(project, 'openspec', 'changes', 'add-cart', 'specs', 'cart'), { recursive: true })
writeFileSync(join(project, 'openspec', 'changes', 'add-cart', 'proposal.md'), '# Carrito')
writeFileSync(join(project, 'openspec', 'changes', 'add-cart', 'specs', 'cart', 'spec.md'), '## ADDED')
mkdirSync(join(project, '.tutti', 'steering'), { recursive: true })
writeFileSync(join(project, '.tutti', 'steering', 'estilo.md'), 'Estilo')
git('checkout', '-q', '-b', 'feature'); writeFileSync(join(project, 'b.ts'), 'bee\n'); git('add', '.'); git('commit', '-q', '-m', 'segundo')
writeFileSync(join(project, 'a.ts'), 'one\nTWO\nthree\n')

describe('referencias # especiales', () => {
  it('lista commits, specs y guías', async () => {
    const refs = await listRefs(project)
    expect(refs.commit.map((c) => c.hint.split(' · ')[0])).toEqual(['segundo', 'primero'])
    expect(refs.spec.map((s) => s.id)).toEqual(['add-cart'])
    expect(refs.steering.map((s) => s.id)).toEqual(['estilo.md'])
    expect(refs.roadmap).toBe(false)
  })

  it('#cambios trae el diff sin confirmar y #rama lo de la rama', async () => {
    expect((await resolve(project, 'cambios', ''))?.body).toContain('+TWO')
    const branch = await resolve(project, 'rama', '')
    expect(branch?.body).toContain('segundo')
    expect(branch?.body).toContain('+bee')
  })

  it('#commit, #spec, #steering y #sel leen lo suyo', async () => {
    const hash = git('rev-parse', '--short', 'HEAD~1').trim()
    expect((await resolve(project, 'commit', hash))?.body).toContain('primero')
    expect((await resolve(project, 'spec', 'add-cart'))?.body).toContain('## specs/cart/spec.md\n## ADDED')
    expect((await resolve(project, 'steering', 'estilo.md'))?.body).toBe('Estilo')
    expect((await resolve(project, 'sel', 'a.ts:2-3'))?.body).toBe('2: TWO\n3: three')
    expect((await resolve(project, 'sel', 'a.ts:2-3', { 'sel:a.ts:2-3': 'sin\nguardar' }))?.body).toBe('2: sin\n3: guardar')      // lo del editor, aunque no esté guardado
  })

  it('rechaza lo inválido o fuera del proyecto', async () => {
    expect(await resolve(project, 'commit', 'zz; rm -rf')).toBeNull()
    expect(await resolve(project, 'spec', '../x')).toBeNull()
    expect(await resolve(project, 'steering', '../../a.ts')).toBeNull()
    expect(await resolve(project, 'sel', '../a.ts:1-2')).toBeNull()
    expect(await resolve(project, 'terminal', 'no-existe')).toBeNull()
  })
})
