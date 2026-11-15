/** Leer y escribir los archivos de configuración de los agentes: JSON tolerante al leer y escrituras de golpe. */
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type Entry = Record<string, unknown>
export const isObject = (v: unknown): v is Entry => typeof v === 'object' && v !== null && !Array.isArray(v)

/** El JSON de `path`; `{}` si no existe o está roto. */
export function readJson(path: string): Entry {
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return isObject(data) ? data : {}
  } catch { return {} }
}

/** El `mcpServers` de un JSON (Claude, Gemini CLI, Qwen Code, Cursor, Antigravity); `{}` si no lo tiene. */
export function readMcpServers(path: string): Entry {
  const found = readJson(path).mcpServers
  return isObject(found) ? found : {}
}

/**
 * Escribe `file` de golpe: a un temporal en la misma carpeta y luego lo renombra. Quien lo lea a la vez (el agente, otra ventana de
 * Tutti) nunca ve un archivo a medias, y si algo falla a mitad el original queda intacto. Si `file` es un enlace se escribe su
 * destino, y se conservan sus permisos (un config.toml con 600 sigue con 600).
 */
export function writeAtomic(file: string, text: string): void {
  let target = file
  let mode: number | undefined
  try { target = realpathSync(file); mode = statSync(target).mode & 0o7777 } catch { /* todavía no existe */ }
  mkdirSync(dirname(target), { recursive: true })
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
  try {
    writeFileSync(tmp, text, { encoding: 'utf8', ...(mode !== undefined ? { mode } : {}) })
    renameSync(tmp, target)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

export const writeJson = (file: string, data: unknown): void => writeAtomic(file, JSON.stringify(data, null, 2) + '\n')
