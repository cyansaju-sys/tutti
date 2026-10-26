/** Chat con un agente sin abrirlo en una terminal: cada mensaje lanza su CLI en modo no interactivo, con la conversación como contexto. */
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import type { AgentInfo, ChatOptions, ChatTurn, ChatUsage, McpResult } from '../../shared/types'
import { CHAT_MODELS } from '../../shared/chatModels'
import { tm } from '../utils/i18n'
import { extendedPath } from '../utils/shellpath'
import { detectAgents } from './agents/agents'
import { collectRefs } from './refs'
import { expandSlash } from './slash'

const TIMEOUT_MS = 5 * 60_000
const MAX_OLD_ATTACHED = 150_000          // de lo adjunto en turnos anteriores se conserva lo más reciente hasta este tamaño
const MAX_OLD_TURNS = 3

/** Cómo se lanza cada agente para solo conversar: sin editar archivos (modo plan o sandbox de solo lectura) y con su modelo por defecto. Claude emite la respuesta por partes. */
const CHAT: Record<string, (prompt: string, model?: string) => string[]> = {
  claude: (p, m) => [...(m ? ['--model', m] : []), '-p', p, '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', 'plan'],
  opencode: (p) => ['run', p],
  gemini: (p, m) => [...(m ? ['-m', m] : []), '-p', p],
  codex: (p, m) => ['exec', ...(m ? ['-m', m] : []), '--sandbox', 'read-only', p],
  agy: (p) => ['--print', p]
}

export const chatAgents = (): AgentInfo[] => detectAgents().filter((a) => a.command in CHAT)

/** Cada mensaje del usuario con lo que citó; de los turnos antiguos solo se mantienen los adjuntos más recientes para que el mensaje no crezca sin fin. */
function withAttachments(history: ChatTurn[]): ChatTurn[] {
  let budget = MAX_OLD_ATTACHED, turns = 0
  const keep = new Set<number>()
  for (let i = history.length - 1; i >= 0; i--) {
    const a = history[i].attached
    if (history[i].role !== 'user' || !a) continue
    if (turns >= MAX_OLD_TURNS || a.length > budget) break
    budget -= a.length; turns++; keep.add(i)
  }
  return history.map((m, i) => (keep.has(i) ? { ...m, text: `${m.text}${m.attached}` } : m))
}

/** La conversación hasta ahora, en un solo texto (cada llamada al agente es independiente). */
export function chatPrompt(history: ChatTurn[]): string {
  const turns = withAttachments(history).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.trim()}`).join('\n\n')
  return `You are chatting with a developer about their project (your working directory). Answer the last message of the conversation, in the language the user writes in. Do not modify any file or run commands that change anything; this is a conversation only.\n\n${turns}\n\nAssistant:`
}

interface Outcome { text: string; error: string; timedOut: boolean; usage?: ChatUsage }

/** Lanza el agente y va avisando con el texto que lleva escrito; devuelve lo que respondió, o por qué falló. */
function run(agent: AgentInfo, args: string[], cwd: string, signal: AbortSignal | undefined, onText: (text: string) => void): Promise<Outcome> {
  return new Promise((done) => {
    let acc = '', final = '', error = '', stderr = '', timedOut = false, pending = ''
    let usage: ChatUsage | undefined
    const child = spawn(agent.path, args, { cwd, signal, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: extendedPath() } })
    const timer = setTimeout(() => { timedOut = true; child.kill() }, TIMEOUT_MS)
    const streamJson = agent.command === 'claude'
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      if (!streamJson) { acc += chunk; onText(acc); return }
      pending += chunk
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        let ev: { type?: string; event?: { type?: string; delta?: { type?: string; text?: string } }; result?: string; is_error?: boolean; total_cost_usd?: number; usage?: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number } }
        try { ev = JSON.parse(line) } catch { continue }
        if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') { acc += ev.event.delta.text ?? ''; onText(acc) }
        else if (ev.type === 'result' && typeof ev.result === 'string') {
          if (ev.is_error) error = ev.result; else final = ev.result
          const u = ev.usage
          if (u) usage = { inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), outputTokens: u.output_tokens ?? 0, costUsd: ev.total_cost_usd }
        }
      }
    })
    child.stderr.setEncoding('utf8').on('data', (c: string) => { stderr = (stderr + c).slice(-600) })
    const finish = (message = ''): void => {
      clearTimeout(timer)
      done({ text: (final || acc).trim(), error: (error || message || stderr.trim().split('\n').filter(Boolean).pop() || '').slice(0, 300), timedOut, usage })
    }
    child.on('error', (e) => finish(e.name === 'AbortError' ? '' : e.message))
    child.on('close', () => finish())
  })
}

export async function chatAsk(project: string | null, command: string, history: ChatTurn[], signal?: AbortSignal, onText: (text: string) => void = () => undefined, options: ChatOptions = {}): Promise<McpResult & { text?: string; attached?: string; usage?: ChatUsage }> {
  const agent = chatAgents().find((a) => a.command === command)
  if (!agent) return { ok: false, message: tm('m.chat.noAgent') }
  if (!history.length) return { ok: false, message: '' }
  const last = history[history.length - 1]
  const lastText = last.role === 'user' ? expandSlash(project, command, last.text) : last.text          // un «/comando» se envía con su texto
  const attached = last.role === 'user' && project ? await collectRefs(project, lastText, options.inline) : ''          // y lo que cita con «#» va tras el mensaje
  const sent = history.map((m, i) => (i === history.length - 1 ? { ...m, text: lastText, attached: attached || undefined } : m.role === 'user' ? { ...m, text: expandSlash(project, command, m.text) } : m))
  const model = options.model && CHAT_MODELS[command]?.includes(options.model) ? options.model : undefined          // solo uno de los conocidos
  const out = await run(agent, CHAT[command](chatPrompt(sent), model), project ?? homedir(), signal, onText)
  if (signal?.aborted) return { ok: false, message: '' }               // cancelado: sin mensaje de error
  if (out.text && !out.error) return { ok: true, message: '', text: out.text, attached: attached || undefined, usage: out.usage }
  if (out.timedOut) return { ok: false, message: tm('m.chat.timeout', { agent: agent.name }) }
  return { ok: false, message: out.error ? tm('m.chat.failedWith', { agent: agent.name, detail: out.error }) : tm('m.chat.failed', { agent: agent.name }) }
}
