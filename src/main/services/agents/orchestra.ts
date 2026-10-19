/**
 * Servidor MCP local para que los agentes repartan tareas entre sí.
 *
 * Escucha solo en 127.0.0.1, con un token aleatorio por ejecución. Cada agente lo ve como un servidor MCP más
 * («tutti») con las herramientas list_agents, delegate_task, wait_agent y read_agent_output. La app (`host`) hace
 * el trabajo real: abrir paneles, escribir en sus terminales y leer su pantalla.
 */
import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

export const PROTOCOL = '2025-03-26'

const INSTRUCTIONS = `Eres un agente de una app que ejecuta varios agentes de programación en paralelo, cada uno con su propio modelo. Herramientas:
- list_agents: agentes abiertos e instalados, con modelo actual, nivel (basic, standard, advanced), límite de uso y modelos que ofrece cada uno (available_models).
- delegate_task: manda una tarea a otro agente; si no está abierto, la app lo abre en su propio panel. Con "model" eliges el modelo exacto.
- read_agent_output / wait_agent: lee la pantalla de un agente o espera a que termine.

Para repartir, llama a delegate_task con "difficulty" (easy, medium o hard) y la app asigna según capacidad y límite de uso. Lo fácil o mecánico \
(renombrar, texto, boilerplate, tests simples, búsquedas) va a agentes basic o standard; lo difícil (arquitectura, bugs sutiles, cambios amplios) \
hazlo tú o pásalo a uno advanced. Para elegir modelo usa available_models sin inventar nombres; si viene vacío, busca en la web el comando con el que \
ese agente lista sus modelos y ejecútalo. Cada tarea debe ser autosuficiente (archivos, objetivo, criterio de terminado) y sin que dos agentes editen \
los mismos archivos. Cuando un agente termina, la app te avisa con un mensaje «[Tutti]»: sigue con lo tuyo y lee el resultado con read_agent_output \
(wait_agent solo si no puedes avanzar sin él). Revisa siempre el resultado antes de darlo por bueno.

Tarea grande o con varias partes: antes de repartir, escribe el plan (en .tutti/roadmap.md y, si es grande, en un cambio de OpenSpec) y revísalo: \
¿está completo?, ¿cada parte tiene criterio de terminado?, ¿hay partes que tocan los mismos archivos? Deriva de él los roles y envíalos con propose_roles: \
cada rol con id, name, responsibility, deliverables, done (criterio de terminado), files (los que solo ese rol edita), difficulty (easy, medium o hard) y dependsOn. \
Mira antes list_role_templates: si el usuario guardó un rol que encaja (tests, revisión, docs…), úsalo con "template" y pon solo lo que cambie. \
El agente y el modelo de cada rol los elige el usuario en el panel de la app (no los asignes tú; con el ajuste roles_assignment en auto, los asigna la app según \
capacidad, límite de uso y modelos disponibles): un agente tiene un solo rol a la vez y, si el elegido no está libre, el rol espera. Si propose_roles devuelve errores, corrígelos y repítelo. Cuando el reparto te parezca bien llama a confirm_roles: la app \
lanza los roles (tras la aprobación del usuario, si hace falta) cuando terminan sus dependencias y te avisa con «[Tutti]». Cada rol puede llevar un \
"check" (comando que la app ejecuta al terminarlo, p. ej. los tests de su parte). Cuando un rol termina pasa a revisión y la app te avisa: revísalo \
contra su criterio de terminado (get_role_result te da su resumen, sus archivos, sus cambios sin commit y el resultado del check) y llama a \
accept_role si está bien o a reject_role con qué corregir; los roles que dependen de él no empiezan hasta que lo aceptes. Un rol que falla o se \
bloquea no cuenta como terminado: resuelve el problema y relánzalo con retry_role.

report_done es solo para trabajadores: úsala si la tarea te llegó de otro agente (con delegate_task) o de la app (un mensaje «[Rol …]»). \
Al acabarla llama a report_done: status "done" si la terminaste, "blocked" si necesitas una respuesta para seguir (explica cuál en summary) o \
"failed" si no pudiste hacerla; en summary, qué hiciste y si algo del criterio de terminado no se cumple. Sin report_done, quien te la pasó no sabe \
con certeza que acabaste. Si eres el líder o la tarea te la dio el usuario directamente, no la llames: contéstale a él.

Si mientras trabajas en una tarea delegada te falta información, pregunta con ask_leader en vez de suponer: la respuesta te llega escrita como \
«[Tutti] Respuesta…». Si te preguntan a ti (aviso «[Tutti] … pregunta»), contesta con answer_agent. Las decisiones que afectan a otros agentes \
(nombres, contratos de API, formatos, convenciones) déjalas con post_note y lee las de los demás con read_notes antes de decidir algo parecido. \
Los avisos «[Tutti]» te llegan escritos cuando estás libre; si trabajas mucho rato seguido, consúltalos con get_updates.`

const ROLE_SCHEMA = {
  type: 'object',
  properties: {
    template: { type: 'string', description: 'Opcional: id de un rol reutilizable del usuario (ver list_role_templates). Rellena los campos que no pongas.' },
    id: { type: 'string', description: 'Identificador corto en minúsculas, números y guiones (p. ej. "api").' },
    name: { type: 'string' },
    responsibility: { type: 'string', description: 'Qué parte del plan hace este rol.' },
    deliverables: { type: 'array', items: { type: 'string' }, description: 'Lo que debe entregar.' },
    done: { type: 'string', description: 'Criterio de terminado: lo que comprobarás al revisar.' },
    files: { type: 'array', items: { type: 'string' }, description: 'Archivos o carpetas que solo este rol edita. Vacío si solo lee.' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    dependsOn: { type: 'array', items: { type: 'string' }, description: 'Ids de roles que deben terminar antes.' },
    check: { type: 'string', description: 'Opcional: comando que la app ejecuta en la raíz del proyecto cuando el rol termina (p. ej. "npm test -- api"). Si falla, la app le devuelve la salida al agente para que lo arregle.' }
  },
  // con `template` basta el id (o ni eso): la app rellena el resto y valida el plan entero
  required: []
}

export const TOOLS = [
  {
    name: 'list_agents',
    description: 'Lista los agentes abiertos (con id, modelo, nivel y si están ocupados) y los instalados que se pueden abrir, ambos con la lista de modelos que ofrece cada agente (available_models) para elegir a quién asignar cada tarea.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'delegate_task',
    description: 'Envía una tarea a otro agente. `agent` es el id de un agente abierto (p. ej. "a2") o el nombre de un agente ' +
      'instalado (p. ej. "opencode" o "claude"): si no hay uno libre, la app abre uno nuevo en su propio panel con la tarea ya ' +
      'cargada. Pasa `difficulty` para que la app revise la lista de agentes, compruebe su capacidad y su límite de uso y asigne el ' +
      'más adecuado (con agent "auto" o sin `agent`); si el agente que pides no tiene capacidad suficiente, te lo rechaza y propone otro.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Id de un agente abierto, nombre de uno instalado o "auto" (con difficulty) para que la app elija.' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Dificultad de la tarea: easy (mecánica), medium o hard (arquitectura, bugs sutiles).' },
        model: { type: 'string', description: 'Modelo concreto con el que debe trabajar el agente (uno de available_models de list_agents). Si el agente ya abierto usa otro, la app abre una instancia nueva con ese modelo. No todos los agentes lo permiten: la app te lo dice.' },
        force: { type: 'boolean', description: 'Mantener el agente pedido aunque no tenga capacidad suficiente.' },
        task: { type: 'string', description: 'Instrucción completa y autosuficiente.' },
        new_instance: { type: 'boolean', description: 'Abrir uno nuevo aunque ya haya uno libre.' }
      },
      required: ['task']
    }
  },
  {
    name: 'propose_roles',
    description: 'Propone los roles de un plan ya escrito y revisado. La app comprueba que sean válidos (sin ciclos ni archivos compartidos) y devuelve a qué agente y modelo asignaría cada uno, sin lanzar nada. Si hay errores, corrígelos y vuelve a llamarla; sustituye a la propuesta anterior mientras no haya roles en marcha.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Resumen del plan o dónde está (roadmap, cambio de OpenSpec).' },
        roles: { type: 'array', items: ROLE_SCHEMA }
      },
      required: ['roles']
    }
  },
  {
    name: 'confirm_roles',
    description: 'Da por revisado el plan de roles propuesto. Si hace falta, la app espera la aprobación del usuario; después lanza cada rol en su agente y modelo cuando terminan sus dependencias y te avisa al terminar.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'report_done',
    description: 'Solo para trabajadores: avisa del resultado de la tarea que te pasó otro agente (con delegate_task) o la app (un rol del plan). Llámala al acabar esa tarea: así quien te la pasó sabe que terminaste y qué hiciste. No la uses para las tareas que te da el usuario directamente.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['done', 'blocked', 'failed'], description: 'done: terminada · blocked: necesitas una respuesta para seguir · failed: no se pudo hacer.' },
        summary: { type: 'string', description: 'Qué hiciste y entregaste; si blocked, qué necesitas; si failed, por qué. Di si algo del criterio de terminado no se cumple.' },
        files_changed: { type: 'array', items: { type: 'string' }, description: 'Archivos que creaste o editaste.' }
      },
      required: ['status', 'summary']
    }
  },
  {
    name: 'get_role_result',
    description: 'Resultado de un rol del plan: estado, agente, el resumen que dejó con report_done, los archivos que tocó y sus cambios sin commit (git diff --stat). Úsala para revisar cada entregable sin leer la pantalla del agente.',
    inputSchema: { type: 'object', properties: { role_id: { type: 'string' } }, required: ['role_id'] }
  },
  {
    name: 'list_role_templates',
    description: 'Roles reutilizables que guardó el usuario (p. ej. tests, revisor, docs), con todos sus campos. Úsalos en propose_roles con "template": "<id>"; lo que pongas explícito manda sobre la plantilla.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'accept_role',
    description: 'Solo el líder: da por bueno un rol en revisión (cumple su criterio de terminado). Los roles que dependen de él pueden empezar.',
    inputSchema: { type: 'object', properties: { role_id: { type: 'string' } }, required: ['role_id'] }
  },
  {
    name: 'reject_role',
    description: 'Solo el líder: rechaza un rol en revisión. El feedback le llega a su agente, que sigue con su contexto y vuelve a avisar al terminar; si su agente ya no está, el rol se relanza con otro llevando el feedback.',
    inputSchema: {
      type: 'object',
      properties: { role_id: { type: 'string' }, feedback: { type: 'string', description: 'Qué falla y qué debe corregir, concreto y comprobable.' } },
      required: ['role_id', 'feedback']
    }
  },
  {
    name: 'retry_role',
    description: 'Vuelve a lanzar un rol del plan que falló, se bloqueó o cuyo agente se cerró. La app lo reparte de nuevo como si no hubiera empezado.',
    inputSchema: { type: 'object', properties: { role_id: { type: 'string' } }, required: ['role_id'] }
  },
  {
    name: 'ask_leader',
    description: 'Pregunta algo a quien te pasó la tarea (el líder) sin darla por terminada. Te quedas esperando: la respuesta te llega escrita como «[Tutti] Respuesta…». Úsala en vez de suponer cuando te falte información.',
    inputSchema: { type: 'object', properties: { question: { type: 'string', description: 'La pregunta, concreta y con el contexto necesario para contestarla.' } }, required: ['question'] }
  },
  {
    name: 'answer_agent',
    description: 'Contesta a un agente que te preguntó con ask_leader o que se bloqueó (report_done con status blocked): sigue con su misma tarea y su contexto.',
    inputSchema: { type: 'object', properties: { agent_id: { type: 'string' }, answer: { type: 'string' } }, required: ['agent_id', 'answer'] }
  },
  {
    name: 'post_note',
    description: 'Deja una nota en la pizarra compartida del proyecto (.tutti/notes.md) para los demás agentes: decisiones que les afectan (nombres, contratos de API, formatos, convenciones). Breve y concreta.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
  },
  {
    name: 'read_notes',
    description: 'Lee las últimas notas de la pizarra compartida del proyecto, con quién las dejó y cuándo.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', description: 'Cuántas (por defecto 30).' } } }
  },
  {
    name: 'get_updates',
    description: 'Devuelve los avisos «[Tutti]» que tienes pendientes (tareas terminadas, preguntas, revisiones) y los da por entregados. La app te los escribe cuando estás libre; úsala si llevas mucho rato trabajando.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'wait_agent',
    description: 'Espera a que un agente termine (sin salida durante `quiet_seconds`) y devuelve las últimas líneas de su pantalla. Úsala solo si no puedes avanzar sin ese resultado: la app te avisa cuando un agente termina.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string' },
        timeout_seconds: { type: 'integer', description: 'Máximo a esperar (por defecto 120).' },
        quiet_seconds: { type: 'integer', description: 'Silencio que cuenta como terminado (5).' },
        lines: { type: 'integer', description: 'Cuántas líneas devolver (por defecto 80).' }
      },
      required: ['agent_id']
    }
  },
  {
    name: 'read_agent_output',
    description: 'Lee las últimas líneas de la pantalla de un agente y dice si sigue ocupado.',
    inputSchema: {
      type: 'object',
      properties: { agent_id: { type: 'string' }, lines: { type: 'integer', description: 'Cuántas líneas (por defecto 80).' } },
      required: ['agent_id']
    }
  }
]

export type ReportStatus = 'done' | 'blocked' | 'failed'
export const isReportStatus = (v: unknown): v is ReportStatus => v === 'done' || v === 'blocked' || v === 'failed'
/** Lo que un agente dice de su tarea con report_done. */
export interface TaskReport { status: ReportStatus; summary: string; files: string[] }

export interface AgentOutput {
  agent_id: string; busy: boolean; idle_seconds: number; text: string; finished?: boolean; note?: string
  /** Lo que el agente avisó con report_done de su última tarea. */
  report?: TaskReport
  /** Está parado esperando un permiso o una respuesta en su panel. */
  awaiting_input?: boolean
  /** Preguntó con ask_leader y espera que le contesten con answer_agent. */
  question?: string
}

/** Lo que la app ofrece al servidor. */
export interface Host {
  listAgents(caller: string): unknown | Promise<unknown>
  delegate(caller: string, target: string, task: string, newInstance: boolean, opts?: { difficulty?: string; force?: boolean; model?: string; role?: string }): Promise<{ ok: boolean; info: unknown }>
  proposeRoles(caller: string, summary: string, roles: unknown): Promise<{ ok: boolean; info: unknown }>
  confirmRoles(caller: string): Promise<{ ok: boolean; info: unknown }>
  report(caller: string, report: TaskReport): { ok: boolean; info: unknown }
  retryRole(caller: string, roleId: string): { ok: boolean; info: unknown }
  roleResult(caller: string, roleId: string): { ok: boolean; info: unknown }
  roleTemplates(caller: string): { ok: boolean; info: unknown }
  acceptRole(caller: string, roleId: string): { ok: boolean; info: unknown }
  askLeader(caller: string, question: string): { ok: boolean; info: unknown }
  answerAgent(caller: string, agentId: string, answer: string): { ok: boolean; info: unknown }
  postNote(caller: string, text: string): { ok: boolean; info: unknown }
  readNotes(caller: string, limit: number): { ok: boolean; info: unknown }
  updates(caller: string): { ok: boolean; info: unknown }
  rejectRole(caller: string, roleId: string, feedback: string): { ok: boolean; info: unknown }
  output(agentId: string, lines: number): AgentOutput | null
  /** wait_agent ya entregó el resultado de este agente: no hace falta avisar al líder. */
  reported?(agentId: string): void
  /** El agente habló con el servidor: tiene report_done y se puede esperar a que avise. */
  seen?(caller: string): void
}

interface RpcMessage { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
const text = (value: unknown, error = false): object => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) }],
  isError: error
})
/** Los argumentos de una llamada; algunos modelos los mandan como texto JSON en vez de como objeto, y se aceptan igual. */
function toolArgs(raw: unknown): Record<string, unknown> {
  let value = raw
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { return {} } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export class Orchestra {
  readonly token = randomBytes(24).toString('base64url')
  port = 0
  private server: Server | null = null

  constructor(private readonly host: Host) {}

  async start(): Promise<this> {
    this.server = createServer((req, res) => void this.onRequest(req, res))
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', resolve)
    })
    this.port = (this.server.address() as AddressInfo).port
    return this
  }

  stop(): void { this.server?.close(); this.server = null }

  /** Entrada de servidor MCP (formato `mcpServers`) para que un agente se conecte como `callerId`. */
  configFor(callerId: string): { type: 'http'; url: string; headers: { Authorization: string } } {
    return { type: 'http', url: `http://127.0.0.1:${this.port}/mcp/${callerId}`, headers: { Authorization: `Bearer ${this.token}` } }
  }

  private send(res: ServerResponse, code: number, payload?: unknown): void {
    const body = payload === undefined ? '' : JSON.stringify(payload)
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
    res.end(body)
  }

  private async onRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.headers.authorization !== `Bearer ${this.token}`) return this.send(res, 401, { error: 'unauthorized' })
    if (req.method === 'GET') return this.send(res, 405)            // no hay canal de eventos del servidor
    if (req.method === 'DELETE') return this.send(res, 200)
    if (req.method !== 'POST') return this.send(res, 405)
    const caller = (req.url ?? '').split('?')[0].replace(/\/+$/, '').split('/').pop() ?? ''
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      size += (chunk as Buffer).length
      if (size > 1_000_000) return this.send(res, 413, { error: 'too large' })
      chunks.push(chunk as Buffer)
    }
    let data: RpcMessage | RpcMessage[]
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return this.send(res, 400, { error: 'invalid json' }) }
    const batch = Array.isArray(data) ? data : [data]
    const replies = (await Promise.all(batch.map((m) => this.handle(m, caller)))).filter((r) => r !== null)
    if (!replies.length) return this.send(res, 202)
    this.send(res, 200, Array.isArray(data) ? replies : replies[0])
  }

  /** JSON-RPC: devuelve null para las notificaciones (sin respuesta). */
  async handle(message: RpcMessage, caller: string): Promise<object | null> {
    const { method, params = {}, id } = message
    if (process.env.TUTTI_MCP_LOG) console.log(`MCP ${caller} ${method}${method === 'tools/call' ? ' ' + String(params.name) : ''}`)   // depuración: qué piden los agentes
    if (caller) this.host.seen?.(caller)
    if (id === undefined || id === null) return null
    try {
      let result: unknown
      if (method === 'initialize') {
        result = {
          protocolVersion: (params.protocolVersion as string) || PROTOCOL, capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'tutti', version: '0.2' }, instructions: INSTRUCTIONS
        }
      } else if (method === 'ping') result = {}
      else if (method === 'tools/list') result = { tools: TOOLS }
      else if (method === 'tools/call') result = await this.call(String(params.name), toolArgs(params.arguments), caller)
      else return { jsonrpc: '2.0', id, error: { code: -32601, message: `método desconocido: ${method}` } }
      return { jsonrpc: '2.0', id, result }
    } catch (e) {          // un fallo de una herramienta no debe tumbar el servidor
      return { jsonrpc: '2.0', id, result: text(`Error interno: ${e instanceof Error ? e.message : String(e)}`, true) }
    }
  }

  private async call(name: string, args: Record<string, unknown>, caller: string): Promise<object> {
    if (name === 'list_agents') return text(await this.host.listAgents(caller))
    if (name === 'delegate_task') {
      const task = String(args.task ?? '').trim()
      const difficulty = args.difficulty === undefined ? undefined : String(args.difficulty)
      if (!task || (!args.agent && !difficulty)) return text('Faltan `task` y `agent` (o `difficulty` para que la app elija).', true)
      if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) return text('`difficulty` debe ser easy, medium o hard.', true)
      const { ok, info } = await this.host.delegate(caller, String(args.agent ?? 'auto'), task, Boolean(args.new_instance), { difficulty, force: Boolean(args.force), model: args.model === undefined ? undefined : String(args.model).trim() || undefined })
      return text(info, !ok)
    }
    if (name === 'propose_roles') {
      const { ok, info } = await this.host.proposeRoles(caller, String(args.summary ?? '').trim(), args.roles)
      return text(info, !ok)
    }
    if (name === 'confirm_roles') {
      const { ok, info } = await this.host.confirmRoles(caller)
      return text(info, !ok)
    }
    if (name === 'report_done') {
      const summary = String(args.summary ?? '').trim()
      if (!isReportStatus(args.status)) return text('`status` debe ser done, blocked o failed.', true)
      if (!summary) return text('Falta `summary`: di qué hiciste (o qué necesitas, o por qué falló).', true)
      const files = Array.isArray(args.files_changed) ? args.files_changed.filter((f): f is string => typeof f === 'string' && !!f.trim()).map((f) => f.trim()) : []
      const { ok, info } = this.host.report(caller, { status: args.status, summary, files })
      return text(info, !ok)
    }
    if (name === 'get_role_result') {
      const { ok, info } = this.host.roleResult(caller, String(args.role_id ?? '').trim())
      return text(info, !ok)
    }
    if (name === 'ask_leader') {
      const question = String(args.question ?? '').trim()
      if (!question) return text('Falta `question`.', true)
      const { ok, info } = this.host.askLeader(caller, question)
      return text(info, !ok)
    }
    if (name === 'answer_agent') {
      const answer = String(args.answer ?? '').trim()
      if (!answer) return text('Falta `answer`.', true)
      const { ok, info } = this.host.answerAgent(caller, String(args.agent_id ?? '').trim(), answer)
      return text(info, !ok)
    }
    if (name === 'post_note') {
      const note = String(args.text ?? '').trim()
      if (!note) return text('Falta `text`.', true)
      const { ok, info } = this.host.postNote(caller, note)
      return text(info, !ok)
    }
    if (name === 'read_notes') {
      const { ok, info } = this.host.readNotes(caller, Math.min(Math.max(Number(args.limit) || 30, 1), 200))
      return text(info, !ok)
    }
    if (name === 'get_updates') {
      const { ok, info } = this.host.updates(caller)
      return text(info, !ok)
    }
    if (name === 'list_role_templates') {
      const { ok, info } = this.host.roleTemplates(caller)
      return text(info, !ok)
    }
    if (name === 'accept_role') {
      const { ok, info } = this.host.acceptRole(caller, String(args.role_id ?? '').trim())
      return text(info, !ok)
    }
    if (name === 'reject_role') {
      const feedback = String(args.feedback ?? '').trim()
      if (!feedback) return text('Falta `feedback`: di qué debe corregir el agente.', true)
      const { ok, info } = this.host.rejectRole(caller, String(args.role_id ?? '').trim(), feedback)
      return text(info, !ok)
    }
    if (name === 'retry_role') {
      const { ok, info } = this.host.retryRole(caller, String(args.role_id ?? '').trim())
      return text(info, !ok)
    }
    if (name === 'read_agent_output') {
      const out = this.host.output(String(args.agent_id ?? ''), Number(args.lines) || 80)
      return out ? text(out) : text('No existe ese agente.', true)
    }
    if (name === 'wait_agent') return this.wait(args)
    return text(`Herramienta desconocida: ${name}`, true)
  }

  private async wait(args: Record<string, unknown>): Promise<object> {
    const id = String(args.agent_id ?? '')
    const timeout = Math.min(Number(args.timeout_seconds) || 120, 600)
    const quiet = Math.max(2, Number(args.quiet_seconds) || 5)
    const deadline = Date.now() + timeout * 1000
    for (;;) {
      const out = this.host.output(id, Number(args.lines) || 80)
      if (!out) return text('No existe ese agente.', true)
      if (out.question) return text({ ...out, finished: false, note: `No terminó: espera tu respuesta a su pregunta. Contéstale con answer_agent(agent_id: "${id}", answer: ...) y no hagas tú su tarea.` })
      if (out.report || out.idle_seconds >= quiet) { this.host.reported?.(id); return text({ ...out, finished: true }) }
      if (out.awaiting_input) return text({ ...out, finished: false, note: 'El agente espera un permiso o una respuesta del usuario en su panel.' })
      if (Date.now() >= deadline) return text({ ...out, finished: false, note: 'Se agotó la espera; el agente sigue trabajando.' })
      await sleep(500)
    }
  }
}
