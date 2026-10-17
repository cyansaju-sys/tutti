import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isOurLauncher, launcherFor, writeLauncher } from '../../../src/main/services/cli'

const TEMPLATE = readFileSync(join(__dirname, '../../../resources/bin/tutti'), 'utf8')
const dir = (): string => mkdtempSync(join(tmpdir(), 'tutti-cli-'))

describe('el lanzador de la terminal', () => {
  it('pone la ruta del AppImage, escapada para las comillas de bash', () => {
    expect(launcherFor(TEMPLATE, '/home/a/Tutti.AppImage')).toContain('APP="/home/a/Tutti.AppImage"')
    expect(launcherFor(TEMPLATE, '/x/$HOME "raro"/`a`\\b')).toContain('APP="/x/\\$HOME \\"raro\\"/\\`a\\`\\\\b"')
    expect(launcherFor(TEMPLATE, '/x/$&')).toContain('APP="/x/\\$&"')          // `$&` no es un patrón de reemplazo
  })

  it('reconoce los suyos (el actual y el de las primeras versiones) y no los ajenos', () => {
    expect(isOurLauncher(TEMPLATE)).toBe(true)
    expect(isOurLauncher('#!/usr/bin/env bash\nexec "/home/a/.local/share/tutti/Tutti.AppImage" "$@"\n')).toBe(true)
    expect(isOurLauncher('#!/bin/sh\necho mío\n')).toBe(false)
  })

  it('lo escribe si falta o está desactualizado, y no pisa uno ajeno', () => {
    const d = dir(), target = join(d, 'bin', 'tutti')
    expect(writeLauncher(TEMPLATE, '/a/Tutti.AppImage', target)).toBe(true)
    expect(statSync(target).mode & 0o777).toBe(0o755)
    expect(writeLauncher(TEMPLATE, '/a/Tutti.AppImage', target)).toBe(false)              // ya al día
    expect(writeLauncher(TEMPLATE, '/b/Tutti.AppImage', target)).toBe(true)               // el AppImage cambió de sitio
    expect(readFileSync(target, 'utf8')).toContain('/b/Tutti.AppImage')
    writeFileSync(target, '#!/bin/sh\necho mío\n')
    expect(writeLauncher(TEMPLATE, '/a/Tutti.AppImage', target)).toBe(false)
    expect(readFileSync(target, 'utf8')).toBe('#!/bin/sh\necho mío\n')
  })

  it.skipIf(process.platform === 'win32')('abre la app con los argumentos y avisa si la ruta no existe', async () => {
    const d = dir(), out = join(d, 'args.txt')
    const app = join(d, 'Tutti.AppImage')
    writeFileSync(app, `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > "${out}"\n`, { mode: 0o755 })
    const launcher = join(d, 'tutti')
    writeLauncher(TEMPLATE, app, launcher)
    mkdirSync(join(d, 'proyecto'))

    const missing = spawnSync(launcher, ['no-existe'], { cwd: d, encoding: 'utf8' })
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('tutti: no existe no-existe')

    const ok = spawnSync(launcher, ['--new-window', 'proyecto'], { cwd: d, encoding: 'utf8' })
    expect(ok.status).toBe(0)
    for (let i = 0; i < 50 && !existsSync(out); i++) await new Promise((r) => setTimeout(r, 20))      // la app se abre aparte
    expect(readFileSync(out, 'utf8')).toBe('--new-window\nproyecto\n')
  })
})
