import { join } from 'node:path'
import type { ChatEffort, ChatModel } from '@/shared/types'
import { codexHome, readText } from './project'

/** Los modelos a los que da acceso la cuenta con la que inició sesión el CLI de Codex: los que él mismo guarda en `models_cache.json` (solo los que muestra en su lista). */
export function listCodexModels(): ChatModel[] {
  try {
    const cache = JSON.parse(readText(join(codexHome(), 'models_cache.json'))) as { models?: Array<{ slug: string; display_name?: string; description?: string; visibility?: string; priority?: number; supported_reasoning_levels?: Array<{ effort: string }> }> }
    const known = ['low', 'medium', 'high', 'xhigh', 'max']
    return (cache.models ?? []).filter((m) => m.visibility === 'list').sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).map((m) => ({
      value: m.slug, displayName: m.display_name || m.slug, description: m.description ?? '',
      efforts: (m.supported_reasoning_levels ?? []).map((l) => l.effort).filter((e): e is ChatEffort => known.includes(e))
    }))
  } catch { return [] }
}
