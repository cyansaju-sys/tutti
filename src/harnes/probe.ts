import type { Query } from '@anthropic-ai/claude-agent-sdk'

/**
 * Abre una consulta del SDK sin enviar ningún mensaje (el prompt nunca emite) solo para preguntarle algo —modelos, comandos…— y la cierra.
 * Usa la sesión con la que ha iniciado sesión Claude Code (la suscripción).
 */
export async function probe<T>(ask: (q: Query) => Promise<T>, cwd?: string): Promise<T> {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const never = (async function* (): AsyncGenerator<never> { await new Promise<never>(() => undefined) })()
  const q = query({ prompt: never, options: { cwd, settingSources: cwd ? ['user', 'project'] : [] } })
  try { return await ask(q) } finally { q.close() }
}
