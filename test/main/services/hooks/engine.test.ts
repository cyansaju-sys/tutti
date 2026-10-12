import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const store: Record<string, unknown> = {}
vi.mock('../../../../src/main/services/settings', () => ({ getSetting: (k: string) => store[k], setSetting: (k: string, v: unknown) => { store[k] = v } }))

import { setTrusted, startHooks, stopHooks, type HookResult } from '../../../../src/main/services/hooks'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
afterEach(() => stopHooks())

function project(hooks: object[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'tutti-engine-'))
  mkdirSync(join(dir, '.tutti', 'hooks'), { recursive: true })
  writeFileSync(join(dir, '.tutti', 'hooks', 'h.json'), JSON.stringify({ version: 'v1', hooks }))
  return dir
}

describe('motor de hooks (PostFileSave)', () => {
  it('al guardar un archivo que coincide ejecuta el comando, con el archivo en el entorno y el contexto por stdin', async () => {
    const dir = project([{ name: 'Marca', trigger: 'PostFileSave', matcher: '\\.ts$', action: { type: 'command', command: 'echo "$TUTTI_HOOK_FILE" > marca.txt && cat > contexto.json' } }])
    setTrusted(dir, true)
    const ran: HookResult[] = []
    startHooks(dir, { notify: (r) => ran.push(r), sendToAgent: () => false })
    await sleep(300)
    writeFileSync(join(dir, 'a.md'), 'no coincide')
    writeFileSync(join(dir, 'a.ts'), 'export {}')
    await sleep(1500)
    expect(readFileSync(join(dir, 'marca.txt'), 'utf8').trim()).toBe('a.ts')
    expect(JSON.parse(readFileSync(join(dir, 'contexto.json'), 'utf8'))).toMatchObject({ trigger: 'PostFileSave', file: 'a.ts' })
    expect(ran).toHaveLength(1)
    expect(ran[0].ok).toBe(true)
  })

  it('un hook de tipo agent escribe su prompt en el agente y avisa si no hay ninguno', async () => {
    const dir = project([{ name: 'Revisar', trigger: 'PostFileSave', action: { type: 'agent', prompt: 'Revisa esto' } }])
    setTrusted(dir, true)
    const sent: string[] = []
    const ran: HookResult[] = []
    startHooks(dir, { notify: (r) => ran.push(r), sendToAgent: (p) => { sent.push(p); return true } })
    await sleep(300)
    writeFileSync(join(dir, 'x.ts'), '1')
    await sleep(1200)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('Revisa esto')
    expect(sent[0]).toContain('x.ts')
    expect(ran[0]).toMatchObject({ name: 'Revisar', ok: true })
  })

  it('no ejecuta nada en un proyecto sin autorizar ni con el hook desactivado', async () => {
    const off = project([{ name: 'Apagado', trigger: 'PostFileSave', enabled: false, action: { type: 'command', command: 'echo si > marca.txt' } }])
    const untrusted = project([{ name: 'Sin permiso', trigger: 'PostFileSave', action: { type: 'command', command: 'echo si > marca.txt' } }])
    setTrusted(off, true)
    startHooks(off, { notify: () => undefined, sendToAgent: () => false })
    await sleep(300); writeFileSync(join(off, 'a.ts'), '1'); await sleep(1000)
    expect(existsSync(join(off, 'marca.txt'))).toBe(false)
    stopHooks()
    startHooks(untrusted, { notify: () => undefined, sendToAgent: () => false })
    await sleep(300); writeFileSync(join(untrusted, 'a.ts'), '1'); await sleep(1000)
    expect(existsSync(join(untrusted, 'marca.txt'))).toBe(false)
  })

  it('un hook que reescribe el archivo no se dispara a sí mismo en bucle', async () => {
    const dir = project([{ name: 'Bucle', trigger: 'PostFileSave', matcher: '^a\\.ts$', action: { type: 'command', command: 'echo x >> veces.txt && echo cambio >> a.ts' } }])
    setTrusted(dir, true)
    startHooks(dir, { notify: () => undefined, sendToAgent: () => false })
    await sleep(300)
    writeFileSync(join(dir, 'a.ts'), 'inicio\n')
    await sleep(3500)
    expect(readFileSync(join(dir, 'veces.txt'), 'utf8').trim().split('\n').length).toBeLessThanOrEqual(2)
  })
})
