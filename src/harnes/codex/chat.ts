import type { WebContents } from 'electron'
import { homedir } from 'node:os'
import type { SandboxMode, ThreadEvent, ThreadItem } from '@openai/codex-sdk'
import { chatMcp } from '@/backend/services/agents/hub'
import { codexExecutable, withPathDirs } from './probe'
import { tuttiPrompt } from '../claude/formats'
import { codexMcp, expandPrompt, projectMcpJson } from './project'
import { expandMentions } from '../claude/mentions'
import { childEnv } from '@/backend/services/agents/env'
import type { ChatEvent, ChatSendRequest } from '@/shared/types'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const runs = new Map<number, AbortController>()
const send = (target: WebContents, event: ChatEvent): void => { if (!target.isDestroyed()) target.send('chat:event', event) }

/** Lo que Codex puede tocar en cada modo del chat: «explorer» y «plan» solo leen; el resto escribe en el proyecto. El SDK no pregunta permisos, así que no hay modo «manual» real. */
const SANDBOX: Record<ChatSendRequest['mode'], SandboxMode> = { manual: 'workspace-write', edit: 'workspace-write', plan: 'read-only', explorer: 'read-only', auto: 'workspace-write' }

/** Una herramienta de Codex como evento del chat; null si el elemento no es una herramienta. */
export function toolEvent(item: ThreadItem): Extract<ChatEvent, { kind: 'tool' }> | null {
  switch (item.type) {
    case 'command_execution': return { kind: 'tool', id: item.id, name: 'Bash', input: item.command.slice(0, 200), body: `$ ${item.command}` }
    case 'file_change': return { kind: 'tool', id: item.id, name: 'Edit', input: item.changes.map((c) => c.path).join(', ').slice(0, 200), body: item.changes.map((c) => `${c.kind === 'add' ? '+' : c.kind === 'delete' ? '-' : '~'} ${c.path}`).join('\n'), file: item.changes[0]?.path }
    case 'mcp_tool_call': return { kind: 'tool', id: item.id, name: `${item.server}:${item.tool}`, input: '', body: JSON.stringify(item.arguments ?? {}, null, 2).slice(0, 2000) }
    case 'web_search': return { kind: 'tool', id: item.id, name: 'WebSearch', input: item.query, body: item.query }
    case 'todo_list': return { kind: 'tool', id: item.id, name: 'TodoWrite', input: `${item.items.filter((i) => i.completed).length}/${item.items.length}`, body: item.items.map((i) => `${i.completed ? '[x]' : '[ ]'} ${i.text}`).join('\n') }
    default: return null
  }
}

/** El resultado de una herramienta ya terminada. */
export function resultEvent(item: ThreadItem): Extract<ChatEvent, { kind: 'toolResult' }> | null {
  if (item.type === 'command_execution') return { kind: 'toolResult', id: item.id, text: item.aggregated_output.slice(-4000), error: item.status === 'failed' || (item.exit_code ?? 0) !== 0 }
  if (item.type === 'file_change') return { kind: 'toolResult', id: item.id, text: item.status, error: item.status === 'failed' }
  if (item.type === 'mcp_tool_call') {
    const text = item.error?.message ?? (item.result?.content ?? []).map((b) => ('text' in b && typeof b.text === 'string' ? b.text : '')).join('\n')
    return { kind: 'toolResult', id: item.id, text: text.slice(0, 4000), error: item.status === 'failed' }
  }
  if (item.type === 'web_search' || item.type === 'todo_list') return { kind: 'toolResult', id: item.id, text: '', error: false }
  return null
}

/** Cada evento del hilo de Codex como eventos del chat. */
export function threadEvents(ev: ThreadEvent, seen: Set<string>): ChatEvent[] {
  if (ev.type === 'thread.started') return [{ kind: 'session', id: ev.thread_id }]
  if (ev.type === 'turn.completed') return [{ kind: 'usage', cost: 0, input: ev.usage.input_tokens, output: ev.usage.output_tokens, cacheRead: ev.usage.cached_input_tokens, cacheWrite: ev.usage.cache_write_input_tokens }]
  if (ev.type === 'turn.failed') return [{ kind: 'error', message: ev.error.message }]
  if (ev.type === 'error') return [{ kind: 'error', message: ev.message }]
  if (ev.type !== 'item.started' && ev.type !== 'item.completed') return []
  const item = ev.item
  const out: ChatEvent[] = []
  if (ev.type === 'item.completed') {
    if (item.type === 'agent_message' && item.text.trim()) return [{ kind: 'text', text: item.text }]
    if (item.type === 'reasoning' && item.text.trim()) return [{ kind: 'thinking', text: item.text }]
    if (item.type === 'error') return [{ kind: 'error', message: item.message }]
  }
  const tool = toolEvent(item)
  if (tool && !seen.has(item.id)) { seen.add(item.id); out.push(tool) }          // la herramienta se muestra al empezar (o al acabar, si nunca se vio empezar)
  if (tool && ev.type === 'item.completed') { const r = resultEvent(item); if (r) out.push(r) }
  return out
}

/** Envía un mensaje al SDK de Codex y va avisando de lo que pasa; termina cuando Codex acaba la respuesta. */
export async function sendCodex(target: WebContents, req: ChatSendRequest): Promise<void> {
  if (runs.has(target.id)) return
  const abort = new AbortController()
  runs.set(target.id, abort)
  const tutti = chatMcp(target.id, req.project ?? homedir(), 'codex')          // el MCP de Tutti: Codex puede repartir tareas a los demás agentes
  try {
    const { Codex } = await import('@openai/codex-sdk')
    const entry = tutti?.servers.tutti
    // el SDK corre sin pantalla: no puede preguntar, y con la política «never» una herramienta MCP que pide aprobación se rechaza sola («requieren aprobación»). Los servidores que el usuario configuró se aprueban salvo en los modos de solo lectura
    const approve = SANDBOX[req.mode] === 'read-only' ? {} : { default_tools_approval_mode: 'approve' }
    const token = (entry?.headers.Authorization ?? '').replace(/^Bearer\s+/i, '')
    const bin = codexExecutable()          // empaquetada, el binario está fuera del asar
    const codex = new Codex({
      codexPathOverride: bin?.path,
      env: withPathDirs(childEnv(entry ? { TUTTI_MCP_TOKEN: token } : {}), bin?.pathDirs ?? []),
      config: { mcp_servers: {          // los del `.mcp.json` del proyecto (Codex no lo lee solo), los de su config.toml y, aparte, el de Tutti
        ...Object.fromEntries(codexMcp(req.project).map((i) => [i.name, { ...approve }])),
        ...Object.fromEntries(projectMcpJson(req.project).map((s) => [s.name, { ...(s.config as never as Record<string, string>), ...approve }])),
        ...(entry ? { tutti: { url: entry.url, bearer_token_env_var: 'TUTTI_MCP_TOKEN', default_tools_approval_mode: 'approve' } } : {})
      } }
    })
    const options = {
      model: req.model && req.model !== 'default' ? req.model : undefined,          // el de la cuenta de Codex que se eligió; sin elegir, el de su config.toml
      workingDirectory: req.project ?? homedir(),
      skipGitRepoCheck: true,
      sandboxMode: SANDBOX[req.mode],
      approvalPolicy: 'never' as const,
      modelReasoningEffort: req.effort === 'max' ? 'xhigh' as const : req.effort,
      webSearchMode: 'live' as const
    }
    const thread = req.session ? codex.resumeThread(req.session, options) : codex.startThread(options)

    const expanded = expandMentions(req.project, expandPrompt(req.text))
    if (expanded.length > req.text.length && expanded.startsWith(req.text)) send(target, { kind: 'context', text: expanded.slice(req.text.length).trim() })
    // las imágenes adjuntas se pasan como archivos temporales: el SDK solo acepta rutas
    const dir = join(tmpdir(), `tutti-codex-${process.pid}`)
    const images = (req.images ?? []).map((img, i) => {
      mkdirSync(dir, { recursive: true })
      const path = join(dir, `${Date.now()}-${i}.${img.mediaType.split('/')[1]}`)
      writeFileSync(path, Buffer.from(img.data, 'base64'))
      return { type: 'local_image' as const, path }
    })
    // Codex no tiene prompt de sistema por el SDK: al empezar la conversación se le explica cómo trabaja Tutti (hooks, specs, terminal) delante del mensaje; las siguientes vueltas ya lo saben
    const text = !req.session && req.project ? `${tuttiPrompt(req.project)}\n\n---\n\n${expanded}` : expanded
    const input = images.length ? [{ type: 'text' as const, text: text || ' ' }, ...images] : text

    const { events } = await thread.runStreamed(input, { signal: abort.signal })
    const seen = new Set<string>()
    for await (const ev of events) for (const e of threadEvents(ev, seen)) send(target, e)
  } catch (e) {
    if (!abort.signal.aborted) send(target, { kind: 'error', message: e instanceof Error ? e.message : String(e) })
  } finally {
    tutti?.release()
    runs.delete(target.id)
    send(target, { kind: 'done' })
  }
}

/** Detiene la respuesta en curso. */
export function cancelCodex(target: WebContents): void { runs.get(target.id)?.abort() }
