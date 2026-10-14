import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { codexEntries } from '../../../../src/main/services/mcp/mcp'
import { parseToml } from '../../../../src/main/services/mcp/toml'

const file = (text: string): string => { const f = join(mkdtempSync(join(tmpdir(), 'tutti-toml-')), 'config.toml'); writeFileSync(f, text); return f }

describe('TOML de Codex', () => {
  it('tablas en línea, arrays en varias líneas y comentarios al final', () => {
    const f = file([
      'model = "o3" # el modelo',
      '[mcp_servers.fs]',
      'command = "npx"  # comentario',
      'args = [',
      '  "-y",       # paquete',
      '  "@a/b",',
      ']',
      'env = { K = "v", "OTRA CLAVE" = \'literal\\sin escape\' }',
      'startup_timeout_sec = 20',
      'enabled = true',
      '[mcp_servers.web]',
      'url = "https://w/mcp"',
      'http_headers = { Authorization = "Bearer t" }'
    ].join('\n'))
    expect(codexEntries(f)).toEqual([
      ['fs', { command: 'npx', args: ['-y', '@a/b'], env: { K: 'v', 'OTRA CLAVE': 'literal\\sin escape' }, startup_timeout_sec: 20, enabled: true }],
      ['web', { url: 'https://w/mcp', headers: { Authorization: 'Bearer t' } }]
    ])
  })
  it('claves con puntos, nombres con comillas y servidores en una tabla en línea', () => {
    const f = file('mcp_servers.a.command = "x"\n[mcp_servers]\n"con espacio" = { url = "https://e/mcp" }\nb.command = "y"\n')
    expect(Object.fromEntries(codexEntries(f))).toEqual({ a: { command: 'x' }, 'con espacio': { url: 'https://e/mcp' }, b: { command: 'y' } })
  })
  it('escapes, cadenas de varias líneas y listas de tablas que se saltan', () => {
    const t = parseToml('a = "x\\ty\\u00e9\\"z"\nb = """\nuno\ndos"""\n[[profiles]]\nc = 1\n[mcp_servers.s]\ncommand = \'c\'\n')
    expect(t.a).toBe('x\tyé"z')
    expect(t.b).toBe('uno\ndos')
    expect(t.c).toBeUndefined()
    expect(t.mcp_servers).toEqual({ s: { command: 'c' } })
  })
  it('lo que no entiende no lo cuelga', () => {
    expect(() => parseToml('= raro\n[\nx = [1, , }\ny = {a=1,,}\n')).not.toThrow()
    expect(codexEntries(file('sin mcp = 1'))).toEqual([])
  })
})
