/** El consumo de Claude visto con el SDK: los límites del plan y los títulos de las conversaciones guardadas. */
import { probe } from './probe'

export interface PlanLimit { key: string; percent: number; resetsAt: number }

/** Los límites del plan (ventana de 5 h y de 7 días, por modelo) tal como los da `/usage`. `available` es false con API key u otros proveedores. */
export const planLimits = (): Promise<{ available: boolean; limits: PlanLimit[] }> => probe(async (q) => {
  const u = await q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true })
  if (!u.rate_limits_available || !u.rate_limits) return { available: false, limits: [] }
  const limits = Object.entries(u.rate_limits as Record<string, { utilization?: number | null; resets_at?: string | null } | null | undefined>).flatMap(([key, v]) =>
    v && v.utilization != null && v.resets_at ? [{ key, percent: Number(v.utilization), resetsAt: Date.parse(v.resets_at) }] : [])
  return { available: true, limits }
})

/** El título de cada conversación guardada (el puesto por el usuario, el resumen o el primer mensaje), por id de sesión. */
export async function sessionTitles(): Promise<Map<string, string>> {
  const { listSessions } = await import('@anthropic-ai/claude-agent-sdk')
  const out = new Map<string, string>()
  for (const s of await listSessions()) {
    const title = (s.customTitle || s.summary || s.firstPrompt || '').trim()
    if (title) out.set(s.sessionId, title)
  }
  return out
}
