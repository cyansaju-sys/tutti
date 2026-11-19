import { app } from 'electron'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'

/** El paquete nativo de Codex para cada plataforma (el que el SDK busca en `@openai/codex-<plataforma>`). */
const TARGETS: Record<string, { pkg: string; triple: string }> = {
  'linux-x64': { pkg: 'codex-linux-x64', triple: 'x86_64-unknown-linux-musl' },
  'linux-arm64': { pkg: 'codex-linux-arm64', triple: 'aarch64-unknown-linux-musl' },
  'darwin-x64': { pkg: 'codex-darwin-x64', triple: 'x86_64-apple-darwin' },
  'darwin-arm64': { pkg: 'codex-darwin-arm64', triple: 'aarch64-apple-darwin' },
  'win32-x64': { pkg: 'codex-win32-x64', triple: 'x86_64-pc-windows-msvc' },
  'win32-arm64': { pkg: 'codex-win32-arm64', triple: 'aarch64-pc-windows-msvc' }
}

/**
 * En la app empaquetada el binario nativo del SDK de Codex queda dentro de `app.asar` y no se puede ejecutar desde ahí: se desempaqueta
 * (`asarUnpack`) y se le indica su ruta real, junto con la carpeta `codex-path` (ripgrep) que el SDK añade al PATH cuando lo encuentra él solo.
 * En desarrollo el SDK lo encuentra solo (null).
 */
export function codexExecutable(): { path: string; pathDirs: string[] } | null {
  if (!app.isPackaged) return null
  const target = TARGETS[`${process.platform}-${process.arch}`]
  if (!target) return null
  const root = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@openai', target.pkg, 'vendor', target.triple)
  const path = join(root, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex')
  if (!existsSync(path)) return null
  return { path, pathDirs: [join(root, 'codex-path')].filter(existsSync) }
}

/** El PATH con las carpetas del binario de Codex delante. */
export const withPathDirs = (env: Record<string, string>, dirs: string[]): Record<string, string> => {
  if (!dirs.length) return env
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  return { ...env, [key]: [...dirs, ...(env[key] ?? '').split(delimiter).filter(Boolean)].join(delimiter) }
}
