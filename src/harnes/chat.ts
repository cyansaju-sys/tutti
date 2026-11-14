/** El chat con Claude: una conversación del SDK por ventana, con sus eventos enviados al renderer. */
import type { WebContents } from 'electron'
import type { Options, PermissionMode, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ChatEvent, ChatSendRequest } from '@/shared/types'

interface Run { abort: AbortController; pending: Map<string, (allow: boolean) => void> }
const runs = new Map<number, Run>()
let permissionId = 1

/** Cada modo del chat en lo que entiende el SDK. «explorer» es solo lectura: no puede editar ni ejecutar nada. */
const MODES: Record<ChatSendRequest['mode'], { permissionMode: PermissionMode; disallowedTools?: string[] }> = {
  manual: { permissionMode: 'default' },
  edit: { permissionMode: 'acceptEdits' },
  plan: { permissionMode: 'plan' },
  explorer: { permissionMode: 'default', disallowedTools: ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Bash'] },
  auto: { permissionMode: 'auto' }
}

/** Resumen corto de lo que hace una herramienta (el archivo, el comando, el patrón…), para mostrarlo en el chat. */
export function summarize(input: Record<string, unknown>): string {
  const v = input.file_path ?? input.path ?? input.command ?? input.pattern ?? input.url ?? input.description ?? input.query
  return typeof v === 'string' ? v.slice(0, 200) : ''
}

const send = (target: WebContents, event: ChatEvent): void => { if (!target.isDestroyed()) target.send('chat:event', event) }

/** Envía un mensaje al SDK y va avisando de lo que pasa; termina cuando Claude acaba la respuesta. */
export async function sendChat(target: WebContents, req: ChatSendRequest): Promise<void> {
  if (runs.has(target.id)) return
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const run: Run = { abort: new AbortController(), pending: new Map() }
  runs.set(target.id, run)
  let finish: () => void = () => undefined
  const finished = new Promise<void>((resolve) => { finish = resolve })

  // con permisos por herramienta el SDK pide una entrada en streaming: se entrega el mensaje y se mantiene abierta hasta el resultado
  const prompt = (async function* (): AsyncGenerator<SDKUserMessage> {
    const images = (req.images ?? []).map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: i.mediaType, data: i.data } }))
    yield { type: 'user', message: { role: 'user', content: images.length ? [...images, { type: 'text' as const, text: req.text || ' ' }] : req.text }, parent_tool_use_id: null }
    await finished
  })()

  const mode = MODES[req.mode]
  const options: Options = {
    cwd: req.project ?? undefined,
    settingSources: req.project ? ['user', 'project', 'local'] : ['user'],
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    abortController: run.abort,
    permissionMode: mode.permissionMode,
    disallowedTools: mode.disallowedTools,
    model: req.model && req.model !== 'default' ? req.model : undefined,
    effort: req.effort,
    resume: req.session ?? undefined,
    canUseTool: (tool, input, { signal }) => new Promise((resolve) => {
      const id = String(permissionId++)
      const settle = (allow: boolean): void => {
        run.pending.delete(id)
        resolve(allow ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'El usuario rechazó esta acción.' })
      }
      run.pending.set(id, settle)
      signal.addEventListener('abort', () => settle(false), { once: true })
      send(target, { kind: 'permission', id, tool, input: summarize(input) })
    })
  }

  try {
    const q = query({ prompt, options })
    for await (const msg of q) {
      if ('session_id' in msg && msg.session_id) send(target, { kind: 'session', id: msg.session_id })
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text.trim()) send(target, { kind: 'text', text: block.text })
          else if (block.type === 'tool_use') send(target, { kind: 'tool', name: block.name, input: summarize(block.input as Record<string, unknown>) })
        }
      } else if (msg.type === 'result') {
        if (msg.is_error) send(target, { kind: 'error', message: 'result' in msg && typeof msg.result === 'string' ? msg.result : 'error' })
        finish()
      }
    }
  } catch (e) {
    if (!run.abort.signal.aborted) send(target, { kind: 'error', message: e instanceof Error ? e.message : String(e) })
  } finally {
    finish()
    runs.delete(target.id)
    send(target, { kind: 'done' })
  }
}

/** Detiene la respuesta en curso. */
export function cancelChat(target: WebContents): void { runs.get(target.id)?.abort.abort() }

/** La respuesta del usuario a una petición de permiso. */
export function answerPermission(target: WebContents, id: string, allow: boolean): void { runs.get(target.id)?.pending.get(id)?.(allow) }
