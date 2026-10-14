import { chmodSync, lstatSync, mkdtempSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readJson, readMcpServers, writeAtomic, writeJson } from '../../../../src/main/services/mcp/files'

const dir = (): string => mkdtempSync(join(tmpdir(), 'tutti-files-'))

describe('archivos de configuración', () => {
  it('lee JSON roto, inexistente o que no es un objeto como {}', () => {
    const d = dir()
    writeFileSync(join(d, 'roto.json'), '{ no')
    writeFileSync(join(d, 'lista.json'), '[1]')
    writeFileSync(join(d, 'ok.json'), JSON.stringify({ mcpServers: { a: { command: 'x' } } }))
    expect(readJson(join(d, 'roto.json'))).toEqual({})
    expect(readJson(join(d, 'lista.json'))).toEqual({})
    expect(readJson(join(d, 'no.json'))).toEqual({})
    expect(readMcpServers(join(d, 'ok.json'))).toEqual({ a: { command: 'x' } })
  })
  it('escribe de golpe: crea carpetas y no deja temporales', () => {
    const d = dir()
    writeJson(join(d, 'a', 'b', 'c.json'), { x: 1 })
    expect(readFileSync(join(d, 'a', 'b', 'c.json'), 'utf8')).toBe('{\n  "x": 1\n}\n')
    expect(readdirSync(join(d, 'a', 'b'))).toEqual(['c.json'])
  })
  it('conserva los permisos y escribe el destino de un enlace', () => {
    if (process.platform === 'win32') return
    const d = dir()
    const real = join(d, 'config.toml')
    writeFileSync(real, 'a = 1\n')
    chmodSync(real, 0o600)
    symlinkSync(real, join(d, 'enlace.toml'))
    writeAtomic(join(d, 'enlace.toml'), 'a = 2\n')
    expect(lstatSync(join(d, 'enlace.toml')).isSymbolicLink()).toBe(true)
    expect(readFileSync(real, 'utf8')).toBe('a = 2\n')
    expect(statSync(real).mode & 0o777).toBe(0o600)
  })
})
