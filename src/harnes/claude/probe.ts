import type { Options, Query } from '@anthropic-ai/claude-agent-sdk'
import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * En la app empaquetada el binario nativo del SDK queda dentro de `app.asar` y no se puede ejecutar desde ahí: se desempaqueta
 * (`asarUnpack`) y se le indica su ruta real. En desarrollo el SDK lo encuentra solo.
 */
export function claudeExecutable(): Options['pathToClaudeCodeExecutable'] {
  if (!app.isPackaged) return undefined
  const base = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@anthropic-ai')
  const name = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const variants = process.platform === 'linux' ? [`linux-${process.arch}`, `linux-${process.arch}-musl`] : [`${process.platform}-${process.arch}`]
  return variants.map((v) => join(base, `claude-agent-sdk-${v}`, name)).find(existsSync)
}

/**
 * Abre una consulta del SDK sin enviar ningún mensaje (el prompt nunca emite) solo para preguntarle algo —modelos, comandos…— y la cierra.
 * Usa la sesión con la que ha iniciado sesión Claude Code (la suscripción).
 */
export async function probe<T>(ask: (q: Query) => Promise<T>, cwd?: string): Promise<T> {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const never = (async function* (): AsyncGenerator<never> { await new Promise<never>(() => undefined) })()
  const q = query({ prompt: never, options: { cwd, settingSources: cwd ? ['user', 'project'] : [], pathToClaudeCodeExecutable: claudeExecutable() } })
  try { return await ask(q) } finally { q.close() }
}
