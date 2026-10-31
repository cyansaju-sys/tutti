import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addWorktree, joinSummary, numstatPath, opArgs, parseWorktrees, removeWorktree, worktrees, worktreePath, branches, checkoutDetached, discardTracked, status, validBranchName } from '../../../../src/main/services/git/git'

const H = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

describe('operaciones sobre un commit', () => {
  it('arma los comandos', () => {
    expect(opArgs('tag', H, 'v1.0')).toEqual(['tag', 'v1.0', H])
    expect(opArgs('branch', H, 'feat/x')).toEqual(['branch', 'feat/x', H])
    expect(opArgs('checkout', H)).toEqual(['checkout', H])
    expect(opArgs('merge', H)).toEqual(['merge', '--no-edit', H])
    expect(opArgs('merge', H, 'noff')).toEqual(['merge', '--no-ff', '--no-edit', H])
    expect(opArgs('merge', H, 'noff,nocommit')).toEqual(['merge', '--no-ff', '--no-commit', H])
    expect(opArgs('merge', H, 'noff,squash')).toEqual(['merge', '--squash', H])
    expect(opArgs('merge', H, '--x')).toBeNull()
    expect(opArgs('reset-hard', H)).toEqual(['reset', '--hard', H])
  })
  it('en un merge, cherry-pick y revert indican el padre', () => {
    expect(opArgs('cherry-pick', H, '', true)).toEqual(['cherry-pick', '-m', '1', H])
    expect(opArgs('revert', H, '', true)).toEqual(['revert', '--no-edit', '-m', '1', H])
    expect(opArgs('revert', H)).toEqual(['revert', '--no-edit', H])
  })
  it('rechaza hashes y nombres peligrosos', () => {
    expect(opArgs('checkout', '--upload-pack=x')).toBeNull()
    expect(opArgs('checkout', 'abc')).toBeNull()
    for (const bad of ['', '-f', 'a b', 'a..b', 'rama/', 'x;rm']) expect(opArgs('branch', H, bad)).toBeNull()
  })
})

describe('resumen de archivos de un commit', () => {
  it('une estado y líneas, también con renombrados y binarios', () => {
    const names = 'M\tsrc/a.ts\nA\tsrc/b.ts\nR100\told/x.ts\tnew/x.ts\nM\timg.png\n'
    const stats = '4\t1\tsrc/a.ts\n10\t0\tsrc/b.ts\n0\t0\t{old => new}/x.ts\n-\t-\timg.png\n'
    expect(joinSummary(names, stats)).toEqual([
      { status: 'M', path: 'src/a.ts', added: 4, deleted: 1 },
      { status: 'A', path: 'src/b.ts', added: 10, deleted: 0 },
      { status: 'R', path: 'new/x.ts', added: 0, deleted: 0 },
      { status: 'M', path: 'img.png', added: 0, deleted: 0 }
    ])
  })
  it('numstatPath entiende las dos formas de renombrado', () => {
    expect(numstatPath('a/{b => c}/d.ts')).toBe('a/c/d.ts')
    expect(numstatPath('x.ts => y.ts')).toBe('y.ts')
    expect(numstatPath('plano.ts')).toBe('plano.ts')
  })
})

describe('nombres de rama', () => {
  it('acepta los habituales y rechaza los que git no admite', () => {
    for (const ok of ['feat/x', 'fix-1', 'release_1.2', 'a']) expect(validBranchName(ok)).toBe(true)
    for (const bad of ['', '-x', 'a b', 'a..b', 'a//b', 'x/', 'x.', 'x.lock', 'a~1', 'a:b']) expect(validBranchName(bad)).toBe(false)
  })
})

describe('estado de un repositorio recién creado', () => {
  it('se reconoce como repositorio aunque aún no tenga commits', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutti-git-'))
    try {
      execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main'])
      writeFileSync(join(dir, '.gitignore'), 'tools\n')
      const st = await status(dir)
      expect(st.isRepo).toBe(true)
      expect(st.branch).toBe('main')
      expect(st.hasRemote).toBe(false)
      expect(st.files.map((f) => f.path)).toEqual(['.gitignore'])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  it('una carpeta sin git no lo es', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutti-nogit-'))
    try { expect((await status(dir)).isRepo).toBe(false) } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('ramas con su último commit', () => {
  it('lista autor, hash y asunto, y permite colocarse sin crear rama', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutti-branches-'))
    const git = (...a: string[]): string => execFileSync('git', ['-C', dir, '-c', 'user.name=Ana', '-c', 'user.email=a@b.c', ...a], { encoding: 'utf8' })
    try {
      git('init', '-q', '-b', 'main')
      writeFileSync(join(dir, 'a.txt'), 'x')
      git('add', '.'); git('commit', '-q', '-m', 'feat: primero')
      git('branch', 'otra')
      const list = await branches(dir)
      const main = list.find((b) => b.name === 'main')
      expect(main).toMatchObject({ current: true, remote: false, author: 'Ana', subject: 'feat: primero' })
      expect(main?.hash).toMatch(/^[0-9a-f]{7,}$/)
      expect(main?.date).toBeGreaterThan(0)
      expect(await checkoutDetached(dir, 'otra')).not.toMatch(/fatal|error/i)
      expect((await branches(dir)).map((b) => b.name).sort()).toEqual(['main', 'otra'])      // HEAD suelto: no aparece «(HEAD detached…)» como rama
      expect(await checkoutDetached(dir, '--x')).toBe('Referencia no válida')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('descartar cambios', () => {
  it('vuelve a la versión guardada, recupera lo borrado y respeta lo preparado', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutti-discard-'))
    const git = (...a: string[]): string => execFileSync('git', ['-C', dir, '-c', 'user.name=Ana', '-c', 'user.email=a@b.c', ...a], { encoding: 'utf8' })
    try {
      git('init', '-q', '-b', 'main')
      writeFileSync(join(dir, 'a.txt'), 'uno\n'); writeFileSync(join(dir, 'b.txt'), 'dos\n'); writeFileSync(join(dir, 'c.txt'), 'tres\n')
      git('add', '-A'); git('commit', '-q', '-m', 'base')
      writeFileSync(join(dir, 'a.txt'), 'cambiado\n')          // modificado sin preparar
      rmSync(join(dir, 'b.txt'))                                 // borrado
      writeFileSync(join(dir, 'c.txt'), 'preparado\n'); git('add', 'c.txt')
      writeFileSync(join(dir, 'c.txt'), 'preparado y más\n')    // preparado y luego tocado otra vez
      expect(await discardTracked(dir, ['a.txt', 'b.txt', 'c.txt'])).toBe('')
      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('uno\n')
      expect(existsSync(join(dir, 'b.txt'))).toBe(true)
      expect(readFileSync(join(dir, 'c.txt'), 'utf8')).toBe('preparado\n')          // lo preparado no se pierde
      expect(await discardTracked(dir, [])).toBe('')
      expect(await discardTracked(dir, ['no-existe.txt'])).not.toBe('')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('worktrees', () => {
  it('interpreta la salida porcelain', () => {
    const out = 'worktree /p/repo\nHEAD aaaaaaaabbbb\nbranch refs/heads/main\n\nworktree /p/repo.worktrees/feat-x\nHEAD ccccccccdddd\nbranch refs/heads/feat/x\nlocked razón\n\nworktree /p/otro\nHEAD eeeeeeeeffff\ndetached\nprunable gitdir roto\n'
    const list = parseWorktrees(out, '/p/repo/src')
    expect(list.map((w) => [w.path, w.branch, w.main, w.current, w.locked, w.prunable])).toEqual([
      ['/p/repo', 'main', true, true, false, false],
      ['/p/repo.worktrees/feat-x', 'feat/x', false, false, true, false],
      ['/p/otro', null, false, false, false, true]
    ])
    expect(list[0].hash).toBe('aaaaaaa')
  })
  it('la carpeta nueva va junto al repositorio', () => {
    expect(worktreePath('/p/repo', 'feat/x')).toBe('/p/repo.worktrees/feat-x')
  })
  it('crea, lista y quita un worktree', async () => {
    const base = mkdtempSync(join(tmpdir(), 'tutti-wt-'))
    const dir = join(base, 'repo')
    const git = (...a: string[]): string => execFileSync('git', ['-C', dir, '-c', 'user.name=Ana', '-c', 'user.email=a@b.c', ...a], { encoding: 'utf8' })
    try {
      execFileSync('git', ['init', '-q', '-b', 'main', dir])
      writeFileSync(join(dir, 'a.txt'), 'x')
      git('add', '.'); git('commit', '-q', '-m', 'primero')
      const made = await addWorktree(dir, 'feat/x', true)
      expect(made.ok).toBe(true)
      expect(made.message).toBe(join(base, 'repo.worktrees', 'feat-x'))
      expect(existsSync(join(made.message, 'a.txt'))).toBe(true)
      expect((await addWorktree(dir, 'feat/x', true)).ok).toBe(false)             // la carpeta ya existe
      expect((await addWorktree(dir, '--mala', true)).ok).toBe(false)
      const list = await worktrees(dir)
      expect(list.map((w) => [w.branch, w.main])).toEqual([['main', true], ['feat/x', false]])
      expect(await removeWorktree(dir, dir, false)).not.toBe('')                  // el principal no se quita
      expect(await removeWorktree(dir, made.message, false)).toBe('')
      expect(existsSync(made.message)).toBe(false)
      expect((await worktrees(dir)).length).toBe(1)
    } finally { rmSync(base, { recursive: true, force: true }) }
  })
})
