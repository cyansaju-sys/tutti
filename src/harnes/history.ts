import type { ChatHistoryMessage } from '@/shared/types'

/** El texto de un contenido de mensaje del SDK (cadena o bloques); los bloques que no son texto (herramientas, imágenes) se ignoran. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((b) => (b && typeof b === 'object' && (b as { type?: string }).type === 'text' ? String((b as { text?: unknown }).text ?? '') : '')).join('').trim()
}

/** Lo que se dijo en una conversación guardada, para mostrarla en el chat al retomarla. Solo el texto de la persona y de Claude. */
export async function sessionHistory(id: string, dir?: string): Promise<ChatHistoryMessage[]> {
  const { getSessionMessages } = await import('@anthropic-ai/claude-agent-sdk')
  const out: ChatHistoryMessage[] = []
  for (const m of await getSessionMessages(id, { dir })) {
    if (m.type !== 'user' && m.type !== 'assistant') continue
    if (m.parent_tool_use_id) continue
    const text = textOf((m.message as { content?: unknown } | undefined)?.content)
    if (text) out.push({ role: m.type, text })
  }
  return out
}
