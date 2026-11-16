/** El chat con Claude: una conversación del SDK por ventana, con sus eventos enviados al renderer. */
import type { WebContents } from 'electron'
import type { Options, PermissionMode, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ChatEvent, ChatPlanDecision, ChatQuestion, ChatSendRequest } from '@/shared/types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { tuttiDir } from '@/backend/services/context/context'
import { childEnv } from '@/backend/services/agents/env'
import { chatMcp } from '@/backend/services/agents/hub'
import { roleSubagents } from '@/backend/services/context/roles'
import { expandMentions } from './mentions'
import { TUTTI_FORMATS } from './formats'
import { claudeExecutable } from './probe'
import { getSetting, setSetting } from '@/backend/services/settings'

interface Run { abort: AbortController; pending: Map<string, (allow: boolean, always?: boolean) => void>; questions: Map<string, (answers: Record<string, string> | null) => void>; plans: Map<string, (d: ChatPlanDecision) => void> }
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

/** Las herramientas que el usuario permitió «siempre» en cada proyecto (se guardan en los ajustes). */
const ALLOW_KEY = 'chat.allow'
const allowed = (project: string | null): string[] => { const all = getSetting(ALLOW_KEY) as Record<string, string[]> | undefined; return all?.[project ?? ''] ?? [] }
const allowAlways = (project: string | null, tool: string): void => {
  const all = { ...((getSetting(ALLOW_KEY) as Record<string, string[]> | undefined) ?? {}) }
  all[project ?? ''] = [...new Set([...(all[project ?? ''] ?? []), tool])]
  setSetting(ALLOW_KEY, all)
}

/** Lo que se ve al abrir una herramienta en el chat: el cambio de un Edit, lo que escribe un Write, el comando de un Bash… */
export function bodyOf(name: string, input: Record<string, unknown>): string {
  const lines = (s: unknown, mark: string): string[] => String(s ?? '').split('\n').map((l) => `${mark} ${l}`)
  const clip = (l: string[]): string => l.slice(0, 60).join('\n') + (l.length > 60 ? `\n… (${l.length - 60})` : '')
  if (name === 'Edit') return clip([...lines(input.old_string, '-'), ...lines(input.new_string, '+')])
  if (name === 'MultiEdit' && Array.isArray(input.edits)) return clip((input.edits as Array<Record<string, unknown>>).flatMap((e) => [...lines(e.old_string, '-'), ...lines(e.new_string, '+')]))
  if (name === 'Write') return clip(lines(input.content, '+'))
  if (name === 'Bash') return `$ ${String(input.command ?? '')}`
  if (name === 'ExitPlanMode') return planText(input)
  return JSON.stringify(input, null, 2).slice(0, 2000)
}

/**
 * El plan que Claude presenta al salir del modo plan: va en el propio input (`plan`) o, en las versiones que lo escriben en un archivo,
 * en `~/.claude/plans/*.md` (se usa el indicado o, si no, el último modificado hace poco). Vacío si no se encuentra.
 */
export function planText(input: Record<string, unknown>, home: string = homedir()): string {
  if (typeof input.plan === 'string' && input.plan.trim()) return input.plan.trim()
  const named = [input.planFilePath, input.plan_file_path, input.planFile].find((v): v is string => typeof v === 'string')
  try {
    if (named) return readFileSync(named, 'utf8').trim()
    const dir = join(home, '.claude', 'plans')
    const latest = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ f, at: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.at - a.at)[0]
    return latest && Date.now() - latest.at < 30 * 60_000 ? readFileSync(join(dir, latest.f), 'utf8').trim() : ''
  } catch { return '' }
}

const textOf = (content: unknown): string => typeof content === 'string' ? content : Array.isArray(content) ? content.map((b: { type?: string; text?: string }) => (b.type === 'text' ? b.text ?? '' : '')).join('\n') : ''

/** Los ajustes del proyecto en `<.tutti|.agents>/settings.json` (permisos, modelo, entorno…, con el formato de los de Claude Code); null si no hay o no son JSON válido. */
export function projectSettings(project: string | null): { settings: Record<string, unknown> | null; error: string } {
  if (!project) return { settings: null, error: '' }
  const file = join(tuttiDir(project), 'settings.json')
  if (!existsSync(file)) return { settings: null, error: '' }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as unknown
    if (data && typeof data === 'object' && !Array.isArray(data)) return { settings: data as Record<string, unknown>, error: '' }
    return { settings: null, error: `${file}: debe ser un objeto JSON` }
  } catch (e) { return { settings: null, error: `${file}: ${e instanceof Error ? e.message : String(e)}` } }
}

/** El AGENTS.md del proyecto (el estándar que leen otros agentes): Claude Code solo conoce CLAUDE.md, así que se le pasa en el prompt. Vacío si no existe o no se lee. */
function agentsMd(project: string): string {
  try {
    const text = readFileSync(join(project, 'AGENTS.md'), 'utf8').trim()
    return text ? `Instrucciones del proyecto (AGENTS.md):\n\n${text}\n\n` : ''
  } catch { return '' }
}

/** El progreso de un subagente (los mensajes `task_*` del SDK) como evento del chat; null si el mensaje es de otra cosa o no es de una herramienta. */
export function taskEvent(msg: { type: string; subtype?: string; [k: string]: unknown }): Extract<ChatEvent, { kind: 'task' }> | null {
  const id = msg.tool_use_id
  if (msg.type !== 'system' || typeof id !== 'string') return null
  const usage = msg.usage as { total_tokens?: number; tool_uses?: number; duration_ms?: number } | undefined
  const stats = { tools: usage?.tool_uses, tokens: usage?.total_tokens, ms: usage?.duration_ms }
  if (msg.subtype === 'task_started') return { kind: 'task', id, status: 'running' }
  if (msg.subtype === 'task_progress') return { kind: 'task', id, status: 'running', ...stats, last: typeof msg.last_tool_name === 'string' ? msg.last_tool_name : undefined }
  if (msg.subtype === 'task_notification' && (msg.status === 'completed' || msg.status === 'failed' || msg.status === 'stopped')) return { kind: 'task', id, status: msg.status, ...stats }
  return null
}

const send = (target: WebContents, event: ChatEvent): void => { if (!target.isDestroyed()) target.send('chat:event', event) }

/** Envía un mensaje al SDK y va avisando de lo que pasa; termina cuando Claude acaba la respuesta. */
export async function sendChat(target: WebContents, req: ChatSendRequest): Promise<void> {
  if (runs.has(target.id)) return
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const run: Run = { abort: new AbortController(), pending: new Map(), questions: new Map(), plans: new Map() }
  runs.set(target.id, run)
  let finish: () => void = () => undefined
  const finished = new Promise<void>((resolve) => { finish = resolve })

  // con permisos por herramienta el SDK pide una entrada en streaming: se entrega el mensaje y se mantiene abierta hasta el resultado
  const expanded = expandMentions(req.project, req.text)
  if (expanded.length > req.text.length && expanded.startsWith(req.text)) send(target, { kind: 'context', text: expanded.slice(req.text.length).trim() })          // lo que se añadió al mensaje (diffs, rutas…): el usuario lo ve
  const prompt = (async function* (): AsyncGenerator<SDKUserMessage> {
    const images = (req.images ?? []).map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: i.mediaType, data: i.data } }))
    yield { type: 'user', message: { role: 'user', content: images.length ? [...images, { type: 'text' as const, text: expanded || ' ' }] : expanded }, parent_tool_use_id: null }
    await finished
  })()

  const mode = MODES[req.mode]
  const own = projectSettings(req.project)
  if (own.error) send(target, { kind: 'error', message: own.error })
  // el MCP de Tutti (si el servidor está en marcha): con él Claude reparte tareas a los agentes que no son Claude Code
  const tutti = chatMcp(target.id, req.project ?? homedir())
  const options: Options = {
    mcpServers: tutti?.servers,
    allowedTools: tutti?.tools,
    cwd: req.project ?? undefined,
    settingSources: req.project ? ['user', 'project', 'local'] : ['user'],
    systemPrompt: {
      type: 'preset', preset: 'claude_code',
      append: req.project ? `${agentsMd(req.project)}${TUTTI_FORMATS}\n\nEl terminal ya está en la carpeta del proyecto (${req.project}) y ahí se queda entre comandos. No empieces los comandos con «cd» ni con rutas absolutas del proyecto: usa rutas relativas. Haz «cd» solo si de verdad necesitas otra carpeta.` : undefined
    },
    agents: roleSubagents(req.project),          // los roles (~/.agents, ~/.tutti y los del proyecto) como subagentes
    abortController: run.abort,
    pathToClaudeCodeExecutable: claudeExecutable(),
    env: childEnv(),          // PATH ampliado (nvm, ~/.local/bin…): así los comandos y los MCP (npx, viamemory…) se encuentran aunque Tutti no se lance desde una terminal
    permissionMode: mode.permissionMode,
    disallowedTools: mode.disallowedTools,
    model: req.model && req.model !== 'default' ? req.model : undefined,
    effort: req.effort,
    thinking: req.thinking ? { type: 'adaptive', display: 'summarized' } : undefined,          // el razonamiento resumido, para mostrarlo
    includePartialMessages: true,
    promptSuggestions: true,          // al acabar cada turno llega un posible mensaje siguiente
    settings: (own.settings ?? undefined) as Options['settings'],
    resume: req.session ?? undefined,
    canUseTool: (tool, input, { signal }) => new Promise((resolve) => {
      if (tool === 'AskUserQuestion' && Array.isArray(input.questions)) {          // las preguntas de Claude: se muestran en el chat y la respuesta vuelve en `answers`
        const id = String(permissionId++)
        const settle = (answers: Record<string, string> | null): void => {
          run.questions.delete(id)
          resolve(answers ? { behavior: 'allow', updatedInput: { ...input, answers } } : { behavior: 'deny', message: 'El usuario no respondió la pregunta.' })
        }
        run.questions.set(id, settle)
        signal.addEventListener('abort', () => settle(null), { once: true })
        send(target, { kind: 'question', id, questions: input.questions as ChatQuestion[] })
        return
      }
      if (tool === 'ExitPlanMode') {          // el plan de Claude: se muestra completo y el usuario lo aprueba o pide cambios
        const id = String(permissionId++)
        const settle = (d: ChatPlanDecision): void => {
          run.plans.delete(id)
          if (d.decision === 'revise') resolve({ behavior: 'deny', message: d.feedback?.trim() ? `El usuario quiere cambios en el plan: ${d.feedback.trim()}` : 'El usuario quiere seguir planeando: no lo apruebes todavía.' })
          else resolve({ behavior: 'allow', updatedInput: input, ...(d.decision === 'approve-edits' ? { updatedPermissions: [{ type: 'setMode' as const, mode: 'acceptEdits' as const, destination: 'session' as const }] } : {}) })
        }
        run.plans.set(id, settle)
        signal.addEventListener('abort', () => settle({ decision: 'revise' }), { once: true })
        send(target, { kind: 'plan', id, plan: planText(input) })
        return
      }
      if (allowed(req.project).includes(tool)) { resolve({ behavior: 'allow', updatedInput: input }); return }
      const id = String(permissionId++)
      const settle = (allow: boolean, always?: boolean): void => {
        run.pending.delete(id)
        if (allow && always) allowAlways(req.project, tool)
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
      if (msg.type === 'stream_event') {
        if (msg.parent_tool_use_id) continue          // lo que escribe un subagente no se va dibujando: llega completo, dentro de su bloque
        const ev = msg.event
        if (ev.type === 'content_block_start' && ev.content_block.type === 'text') send(target, { kind: 'blockstart' })
        else if (ev.type === 'content_block_start' && ev.content_block.type === 'thinking') send(target, { kind: 'blockstart', think: true })
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') send(target, { kind: 'delta', text: ev.delta.text })
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'thinking_delta') send(target, { kind: 'delta', text: ev.delta.thinking, think: true })
      } else if (msg.type === 'system') {
        const task = taskEvent(msg)
        if (task) send(target, task)
      } else if (msg.type === 'assistant') {
        const parent = msg.parent_tool_use_id ?? undefined          // distinto de null: lo dice un subagente
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text.trim()) send(target, { kind: 'text', text: block.text, parent })
          else if (block.type === 'thinking' && block.thinking.trim()) send(target, { kind: 'thinking', text: block.thinking, parent })
          else if (block.type === 'tool_use') {
            const input = block.input as Record<string, unknown>
            send(target, { kind: 'tool', id: block.id, name: block.name, input: summarize(input), body: bodyOf(block.name, input), file: typeof input.file_path === 'string' ? input.file_path : undefined, parent, sub: typeof input.subagent_type === 'string' ? input.subagent_type : undefined })
          }
        }
      } else if (msg.type === 'user') {
        const content = (msg.message as { content?: unknown }).content
        if (Array.isArray(content)) for (const b of content as Array<{ type?: string; tool_use_id?: string; content?: unknown; is_error?: boolean }>) {
          if (b.type === 'tool_result' && b.tool_use_id) send(target, { kind: 'toolResult', id: b.tool_use_id, text: textOf(b.content).slice(0, 4000), error: !!b.is_error })
        }
      } else if (msg.type === 'prompt_suggestion') {
        if (msg.suggestion.trim()) send(target, { kind: 'suggestion', text: msg.suggestion.trim() })
      } else if (msg.type === 'result') {
        const u = msg.usage as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | undefined
        send(target, { kind: 'usage', cost: msg.total_cost_usd ?? 0, input: u?.input_tokens ?? 0, output: u?.output_tokens ?? 0, cacheRead: u?.cache_read_input_tokens ?? 0, cacheWrite: u?.cache_creation_input_tokens ?? 0 })
        if (msg.is_error) send(target, { kind: 'error', message: 'result' in msg && typeof msg.result === 'string' ? msg.result : 'error' })
        finish()
      }
    }
  } catch (e) {
    if (!run.abort.signal.aborted) send(target, { kind: 'error', message: e instanceof Error ? e.message : String(e) })
  } finally {
    finish()
    tutti?.release()
    runs.delete(target.id)
    send(target, { kind: 'done' })
  }
}

/** Detiene la respuesta en curso. */
export function cancelChat(target: WebContents): void { runs.get(target.id)?.abort.abort() }

/** La respuesta del usuario a una petición de permiso. */
export function answerPermission(target: WebContents, id: string, allow: boolean, always?: boolean): void { runs.get(target.id)?.pending.get(id)?.(allow, always) }

/** Las respuestas del usuario a una pregunta de Claude (pregunta -> respuesta); null si la descartó. */
export function answerQuestion(target: WebContents, id: string, answers: Record<string, string> | null): void { runs.get(target.id)?.questions.get(id)?.(answers) }

/** La decisión del usuario sobre el plan que Claude presentó. */
export function answerPlan(target: WebContents, id: string, d: ChatPlanDecision): void { runs.get(target.id)?.plans.get(id)?.(d) }
