import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { expandMentions } from '@/harnes/mentions'

let project = ''
beforeEach(() => { project = mkdtempSync(join(tmpdir(), 'tutti-mentions-')); process.env.TUTTI_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'tutti-cfg-')) })
afterEach(() => rmSync(project, { recursive: true, force: true }))
const put = (rel: string, text = ''): void => { const f = join(project, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, text) }

describe('menciones #', () => {
  it('sin menciones o sin proyecto el mensaje queda igual', () => {
    expect(expandMentions(project, 'hola')).toBe('hola')
    expect(expandMentions(null, '#role:dev')).toBe('#role:dev')
  })

  it('una spec y un archivo se explican al final del mensaje', () => {
    put('.tutti/specs/carrito/tasks.md', '- [ ] a\n')
    const out = expandMentions(project, 'sigue con #spec:carrito y mira #file:src/a.ts')
    expect(out.startsWith('sigue con #spec:carrito y mira #file:src/a.ts')).toBe(true)
    expect(out).toContain('.tutti/specs/carrito')
    expect(out).toContain('Archivo src/a.ts')
  })

  it('un documento de .tutti/docs se explica con su ruta', () => {
    put('.tutti/docs/how-to/desplegar.md', '# Cómo desplegar\n')
    expect(expandMentions(project, 'sigue #doc:how-to/desplegar')).toContain('.tutti/docs/how-to/desplegar.md')
  })

  it('los cambios sin confirmar se pegan como diff', () => {
    const git = (...a: string[]): void => { execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: project }) }
    git('init', '-q'); put('a.txt', 'uno\n'); git('add', '.'); git('commit', '-qm', 'x')
    put('a.txt', 'uno\ndos\n')
    const out = expandMentions(project, 'mira #diff:a.txt')
    expect(out).toContain('```diff')
    expect(out).toContain('+dos')
    expect(expandMentions(project, '#diff:all')).toContain('+dos')
    expect(expandMentions(project, '#diff:nada.txt')).toContain('archivo nuevo sin seguimiento')
  })

  it('lo que no existe se ignora y no se repite', () => {
    expect(expandMentions(project, '#spec:nada')).toBe('#spec:nada')
    expect(expandMentions(project, '#dir:src #dir:src').match(/Carpeta src/g)).toHaveLength(1)
  })
})

describe('Powers por palabras clave', () => {
  it('un Power que encaja con lo pedido se ofrece solo, y uno que no, no', () => {
    put('.tutti/powers/stripe/plugin.json', JSON.stringify({ name: 'stripe', description: 'Pagos con Stripe', keywords: ['pagos', 'cobros'] }))
    put('.tutti/powers/figma/plugin.json', JSON.stringify({ name: 'figma', description: 'Diseño', keywords: ['diseño'] }))
    put('.tutti/powers/stripe/mcp.json', JSON.stringify({ mcpServers: { s: { command: 'x' } } }))
    put('.tutti/powers/figma/mcp.json', JSON.stringify({ mcpServers: { f: { command: 'y' } } }))
    const out = expandMentions(project, 'arregla los pagos del carrito')
    expect(out).toContain('Power «stripe»')
    expect(out).not.toContain('Power «figma»')
    expect(expandMentions(project, 'hola')).toBe('hola')
  })
})
