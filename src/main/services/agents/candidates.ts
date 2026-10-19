/** A quién se le puede dar trabajo: los agentes abiertos y los instalados, con su nivel, su límite de uso y su historial. */
import { detectAgents } from './agents'
import type { Candidate } from './assign'
import { trackRecord } from './history'
import { currentLeader } from './leader'
import { availableModels, currentModel, MODEL_FLAG, tier } from './models'
import * as pty from './pty'
import type { RoleCandidate } from './roles'
import { busy } from './runtime'
import { claudeLimits } from '../usage/usage'
import { readCodexData } from '../usage/codexDb'

/** Porcentaje usado del límite más ajustado de un agente (Claude y Codex; usa lo último que se sabe, sin pedir nada). */
export async function quotaOf(command: string): Promise<number | undefined> {
  if (command === 'codex') {          // Codex deja sus límites en sus propios registros: no hace falta red
    try { const limits = readCodexData(Date.now())?.limits ?? []; return limits.length ? Math.max(...limits.map((l) => l.percent)) : undefined } catch { return undefined }
  }
  if (command !== 'claude') return undefined
  try {
    const { limits } = await claudeLimits(false)
    return limits.length ? Math.max(...limits.map((l) => l.percent)) : undefined
  } catch { return undefined }
}

/** Todo lo que se podría usar para una tarea: los paneles abiertos (menos quien pide y el líder) y los instalados por abrir. */
export async function candidates(caller: string, cwd: string | undefined, withModels = false): Promise<RoleCandidate[]> {
  const open = pty.agentSessions()
  const leader = currentLeader()
  const quotas = new Map<string, number | undefined>()
  const quota = async (command: string): Promise<number | undefined> => {
    if (!quotas.has(command)) quotas.set(command, await quotaOf(command))
    return quotas.get(command)
  }
  const out: RoleCandidate[] = []
  for (const m of open) {
    if (m.id === caller || m.id === leader?.id) continue
    const model = currentModel(m.command, m.cwd)
    out.push({ id: m.id, name: m.name, command: m.command, tier: tier(model).tier, busy: busy(m.id), quota: await quota(m.command), history: trackRecord(m.command, model) })
  }
  for (const a of detectAgents()) {
    // los modelos solo se piden al repartir roles: leerlos puede abrir el agente un momento
    const models = withModels ? { models: await availableModels(a.command, a.path, cwd), canSetModel: !!MODEL_FLAG[a.command] } : {}
    const model = cwd ? currentModel(a.command, cwd) : null
    out.push({ name: a.name, command: a.command, tier: tier(model).tier, busy: false, quota: await quota(a.command), history: trackRecord(a.command, model), ...models })
  }
  return out
}

export const nameOf = (c: Candidate): string => (c.id ? `${c.name} (${c.id})` : `${c.name} (por abrir)`)
