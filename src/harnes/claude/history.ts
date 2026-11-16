import type { ChatHistoryMessage } from '@/shared/types'
import { bodyOf, summarize } from './chat'

type Block = { type?: string; text?: string; thinking?: string; id?: string; name?: string; input?: unknown; tool_use_id?: string; content?: unknown; is_error?: boolean }
const blocksOf = (content: unknown): Block[] => (Array.isArray(content) ? content.filter((b): b is Block => !!b && typeof b === 'object') : [])

/** El texto de un contenido de mensaje del SDK (cadena o bloques); los bloques que no son texto (herramientas, imágenes) se ignoran. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  return blocksOf(content).map((b) => (b.type === 'text' ? String(b.text ?? '') : '')).join('').trim()
}

/** El texto de un resultado de herramienta (cadena o bloques de texto), recortado como en el chat en directo. */
const resultText = (content: unknown): string => (typeof content === 'string' ? content : blocksOf(content).map((b) => (b.type === 'text' ? String(b.text ?? '') : '')).join('\n')).slice(0, 4000)

/**
 * Los mensajes guardados de una conversación como los muestra el chat en directo: lo que dijeron la persona y Claude, su razonamiento,
 * las herramientas con su resultado y lo que hizo cada subagente (colgando de su herramienta Agent).
 */
export function historyOf(messages: Array<{ type: string; message?: unknown; parent_tool_use_id?: string | null }>): ChatHistoryMessage[] {
  const out: ChatHistoryMessage[] = []
  const tools = new Map<string, ChatHistoryMessage>()
  for (const m of messages) {
    if (m.type !== 'user' && m.type !== 'assistant') continue
    const parent = m.parent_tool_use_id || undefined
    const content = (m.message as { content?: unknown } | undefined)?.content
    if (m.type === 'user') {
      for (const b of blocksOf(content)) {          // los resultados se cuelgan de su herramienta
        const tool = b.type === 'tool_result' && b.tool_use_id ? tools.get(b.tool_use_id) : undefined
        if (tool) { tool.result = resultText(b.content); tool.resultError = !!b.is_error }
      }
      if (parent) continue          // lo que se le pide a un subagente ya está en su herramienta Agent
      const text = textOf(content)
      if (text) out.push({ role: 'user', text })
      continue
    }
    if (typeof content === 'string') { if (content.trim()) out.push({ role: 'assistant', text: content, parent }); continue }
    for (const b of blocksOf(content)) {
      if (b.type === 'text' && b.text?.trim()) out.push({ role: 'assistant', text: b.text, parent })
      else if (b.type === 'thinking' && b.thinking?.trim()) out.push({ role: 'thinking', text: b.thinking, parent })
      else if (b.type === 'tool_use' && b.id && b.name) {
        const input = (b.input ?? {}) as Record<string, unknown>
        const tool: ChatHistoryMessage = { role: 'tool', text: b.name, detail: summarize(input), body: bodyOf(b.name, input), toolId: b.id, parent,
          file: typeof input.file_path === 'string' ? input.file_path : undefined, sub: typeof input.subagent_type === 'string' ? input.subagent_type : undefined }
        tools.set(b.id, tool)
        out.push(tool)
      }
    }
  }
  return out
}

/** Lo que se dijo e hizo en una conversación guardada, para mostrarla en el chat al retomarla. */
export async function sessionHistory(id: string, dir?: string): Promise<ChatHistoryMessage[]> {
  const { getSessionMessages } = await import('@anthropic-ai/claude-agent-sdk')
  return historyOf(await getSessionMessages(id, { dir }))
}
