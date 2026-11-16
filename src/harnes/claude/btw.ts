/** «/btw»: una pregunta al margen. Se responde con lo que Claude ya sabe de la conversación, sin herramientas y sin guardarse en ella; puede hacerse mientras otra respuesta sigue en curso. */
import type { WebContents } from 'electron'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import type { ChatBtwRequest, ChatEvent } from '@/shared/types'
import { childEnv } from '@/backend/services/agents/env'
import { claudeExecutable } from './probe'

const running = new Map<string, AbortController>()
const ASIDE = 'Esta es una pregunta al margen (/btw) mientras trabajas en otra cosa: responde breve y directo con lo que ya sabes de la conversación. No uses herramientas ni cambies nada.'

export async function askBtw(target: WebContents, req: ChatBtwRequest): Promise<void> {
  const out = (event: ChatEvent): void => { if (!target.isDestroyed()) target.send('chat:event', event) }
  const abort = new AbortController()
  running.set(req.id, abort)
  const options: Options = {
    cwd: req.project ?? undefined,
    settingSources: req.project ? ['user', 'project', 'local'] : ['user'],
    systemPrompt: { type: 'preset', preset: 'claude_code', append: ASIDE },
    abortController: abort,
    pathToClaudeCodeExecutable: claudeExecutable(),
    env: childEnv(),
    model: req.model && req.model !== 'default' ? req.model : undefined,
    tools: [],          // sin herramientas: solo contesta
    maxTurns: 1,
    includePartialMessages: true,
    resume: req.session ?? undefined,
    forkSession: !!req.session,          // sobre una copia: la conversación original no cambia
    persistSession: false                // y la copia no se guarda (no aparece en el historial)
  }
  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')
    for await (const msg of query({ prompt: req.question, options })) {
      if (msg.type === 'stream_event') {
        const ev = msg.event
        if (!msg.parent_tool_use_id && ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') out({ kind: 'btw', id: req.id, text: ev.delta.text })
      } else if (msg.type === 'result' && msg.is_error) {
        out({ kind: 'btw', id: req.id, error: 'result' in msg && typeof msg.result === 'string' ? msg.result : 'error' })
      }
    }
  } catch (e) {
    if (!abort.signal.aborted) out({ kind: 'btw', id: req.id, error: e instanceof Error ? e.message : String(e) })
  } finally {
    running.delete(req.id)
    out({ kind: 'btw', id: req.id, done: true })
  }
}

export function cancelBtw(id: string): void { running.get(id)?.abort() }
