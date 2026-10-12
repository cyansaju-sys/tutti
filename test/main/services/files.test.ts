import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEntry, moveEntry, renameEntry, validName } from '../../../src/main/services/files'

const dir = (): string => mkdtempSync(join(tmpdir(), 'tutti-files-'))

describe('crear y renombrar', () => {
  it('solo acepta nombres simples', () => {
    for (const bad of ['', ' ', '..', '.', 'a/b', 'a\\b', ' a']) expect(validName(bad)).toBe(false)
    expect(validName('archivo.ts')).toBe(true)
  })
  it('crea archivo y carpeta, sin pisar lo que existe', async () => {
    const d = dir()
    expect((await createEntry(d, 'a.txt', false)).ok).toBe(true)
    expect((await createEntry(d, 'sub', true)).ok).toBe(true)
    expect(existsSync(join(d, 'a.txt')) && existsSync(join(d, 'sub'))).toBe(true)
    expect((await createEntry(d, 'a.txt', false)).ok).toBe(false)
    expect((await createEntry(d, '../../fuera', false)).ok).toBe(false)
  })
  it('renombra en la misma carpeta y avisa si el nombre ya está', async () => {
    const d = dir()
    writeFileSync(join(d, 'a.txt'), 'x'); writeFileSync(join(d, 'b.txt'), 'y')
    const ok = await renameEntry(join(d, 'a.txt'), 'c.txt')
    expect(ok).toEqual({ ok: true, message: join(d, 'c.txt') })
    expect(existsSync(join(d, 'a.txt'))).toBe(false)
    expect((await renameEntry(join(d, 'c.txt'), 'b.txt')).ok).toBe(false)
    expect((await renameEntry(join(d, 'c.txt'), '../../x')).ok).toBe(false)
  })
})

describe('mover a una carpeta', () => {
  it('mueve un archivo o una carpeta con su contenido y devuelve la ruta nueva', async () => {
    const d = dir()
    mkdirSync(join(d, 'destino')); mkdirSync(join(d, 'otra')); writeFileSync(join(d, 'otra', 'dentro.txt'), 'x'); writeFileSync(join(d, 'a.txt'), 'x')
    const file = await moveEntry(join(d, 'a.txt'), join(d, 'destino'))
    expect(file).toEqual({ ok: true, message: join(d, 'destino', 'a.txt') })
    expect(existsSync(join(d, 'a.txt'))).toBe(false)
    expect((await moveEntry(join(d, 'otra'), join(d, 'destino'))).ok).toBe(true)
    expect(existsSync(join(d, 'destino', 'otra', 'dentro.txt'))).toBe(true)
  })
  it('no pisa lo que ya existe y no mete una carpeta dentro de sí misma', async () => {
    const d = dir()
    mkdirSync(join(d, 'destino')); mkdirSync(join(d, 'padre')); mkdirSync(join(d, 'padre', 'hija'))
    writeFileSync(join(d, 'a.txt'), 'nuevo'); writeFileSync(join(d, 'destino', 'a.txt'), 'viejo')
    expect((await moveEntry(join(d, 'a.txt'), join(d, 'destino'))).ok).toBe(false)
    expect(existsSync(join(d, 'a.txt'))).toBe(true)
    expect((await moveEntry(join(d, 'padre'), join(d, 'padre', 'hija'))).ok).toBe(false)
    expect((await moveEntry(join(d, 'padre'), join(d, 'padre'))).ok).toBe(false)
  })
  it('moverlo a la carpeta donde ya está no hace nada', async () => {
    const d = dir()
    writeFileSync(join(d, 'a.txt'), 'x')
    expect(await moveEntry(join(d, 'a.txt'), d)).toEqual({ ok: true, message: join(d, 'a.txt') })
  })
})
