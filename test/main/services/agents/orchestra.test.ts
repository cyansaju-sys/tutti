import { afterEach, describe, expect, it } from 'vitest'
import { Orchestra, TOOLS, type Host } from '../../../../src/main/services/agents/orchestra'

const calls: unknown[][] = []
const host: Host = {
  listAgents: (caller) => ({ you_are: caller, open_agents: [] }),
  delegate: async (caller, target, task, fresh, opts) => { calls.push(opts?.difficulty ? [caller, target, task, fresh, opts] : [caller, target, task, fresh]); return target === 'malo' ? { ok: false, info: 'no existe' } : { ok: true, info: { agent_id: target } } },
  proposeRoles: async (caller, summary, roles) => { calls.push([caller, 'propose', summary, roles]); return Array.isArray(roles) && roles.length ? { ok: true, info: { roles: [] } } : { ok: false, info: 'sin roles' } },
  confirmRoles: async (caller) => { calls.push([caller, 'confirm']); return { ok: true, info: { status: 'approved' } } },
  report: (caller, report) => { calls.push([caller, 'report', report]); return { ok: true, info: 'recibido' } },
  retryRole: (caller, roleId) => { calls.push([caller, 'retry', roleId]); return roleId === 'api' ? { ok: true, info: 'lista' } : { ok: false, info: 'no existe' } },
  roleResult: (caller, roleId) => (roleId === 'api' ? { ok: true, info: { role: 'api', summary: 'rutas hechas' } } : { ok: false, info: 'no existe' }),
  acceptRole: (caller, roleId) => { calls.push([caller, 'accept', roleId]); return { ok: roleId === 'api', info: roleId === 'api' ? 'aceptado' : 'no está en revisión' } },
  rejectRole: (caller, roleId, feedback) => { calls.push([caller, 'reject', roleId, feedback]); return { ok: true, info: 'devuelto' } },
  askLeader: (caller, question) => { calls.push([caller, 'ask', question]); return caller === 'a1' ? { ok: true, info: 'enviada' } : { ok: false, info: 'sin tarea' } },
  answerAgent: (caller, agentId, answer) => { calls.push([caller, 'answer', agentId, answer]); return { ok: true, info: 'enviada' } },
  postNote: (caller, text) => { calls.push([caller, 'note', text]); return { ok: true, info: 'guardada' } },
  readNotes: (caller, limit) => { calls.push([caller, 'notes', limit]); return { ok: true, info: { notes: ['una'] } } },
  updates: (caller) => ({ ok: true, info: { updates: [`para ${caller}`] } }),
  roleTemplates: () => ({ ok: true, info: { templates: [{ id: 'tests' }] } }),
  listPowers: () => ({ ok: true, info: { powers: [{ name: 'db' }] } }),
  usePower: async (caller, name) => { calls.push([caller, 'power', name]); return name === 'db' ? { ok: true, info: { guide: 'usa pg' } } : { ok: false, info: 'no existe' } },
  seen: (caller) => { seen.add(caller) },
  output: (id) => (id === 'a2' ? { agent_id: 'a2', busy: false, idle_seconds: 9, text: 'listo' }
    : id === 'a3' ? { agent_id: 'a3', busy: false, idle_seconds: 0, text: '…', report: { status: 'done', summary: 'hecho', files: [] } }
    : id === 'a4' ? { agent_id: 'a4', busy: false, idle_seconds: 0, text: 'Do you want to proceed?', awaiting_input: true }
    : id === 'a5' ? { agent_id: 'a5', busy: false, idle_seconds: 30, text: 'Esperando respuesta', question: '¿español o inglés?' }
    : null)
}
const seen = new Set<string>()
let server: Orchestra | null = null
afterEach(() => { server?.stop(); server = null; calls.length = 0; seen.clear() })

async function start(): Promise<{ post: (body: unknown, token?: string) => Promise<Response>; o: Orchestra }> {
  server = await new Orchestra(host).start()
  const o = server
  const cfg = o.configFor('a1')
  return { o, post: (body, token = cfg.headers.Authorization) => fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token }, body: JSON.stringify(body) }) }
}
const rpc = (method: string, params: object = {}, id = 1): object => ({ jsonrpc: '2.0', id, method, params })

describe('servidor MCP de reparto de tareas', () => {
  it('solo escucha en 127.0.0.1 y exige el token', async () => {
    const { post, o } = await start()
    expect(o.configFor('a1').url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp\/a1$/)
    expect((await post(rpc('initialize'), 'Bearer incorrecto')).status).toBe(401)
    expect((await post(rpc('initialize'))).status).toBe(200)
  })

  it('initialize, ping y la lista de herramientas', async () => {
    const { post } = await start()
    const init = await (await post(rpc('initialize', { protocolVersion: '2025-03-26' }))).json()
    expect(init.result.serverInfo.name).toBe('tutti')
    expect(init.result.instructions).toContain('delegate_task')
    expect(await (await post(rpc('ping'))).json()).toMatchObject({ result: {} })
    const tools = await (await post(rpc('tools/list'))).json()
    expect(tools.result.tools.map((t: { name: string }) => t.name)).toEqual(TOOLS.map((t) => t.name))
    expect(tools.result.tools).toHaveLength(19)
  })

  it('las notificaciones no tienen respuesta y un método desconocido da error', async () => {
    const { post } = await start()
    expect((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202)
    const bad = await (await post(rpc('no/existe'))).json()
    expect(bad.error.code).toBe(-32601)
  })

  it('delegate_task pasa quién pide, a quién y la tarea; los errores llegan como isError', async () => {
    const { post } = await start()
    const ok = await (await post(rpc('tools/call', { name: 'delegate_task', arguments: { agent: 'a2', task: ' haz algo ', new_instance: true } }))).json()
    expect(ok.result.isError).toBe(false)
    expect(calls[0]).toEqual(['a1', 'a2', 'haz algo', true])
    const bad = await (await post(rpc('tools/call', { name: 'delegate_task', arguments: { agent: 'malo', task: 'x' } }))).json()
    expect(bad.result.isError).toBe(true)
    const missing = await (await post(rpc('tools/call', { name: 'delegate_task', arguments: { agent: 'a2' } }))).json()
    expect(missing.result.isError).toBe(true)
  })

  it('delegate_task con difficulty deja que la app elija; sin agente ni dificultad falla', async () => {
    const { post } = await start()
    const auto = await (await post(rpc('tools/call', { name: 'delegate_task', arguments: { task: 'x', difficulty: 'hard' } }))).json()
    expect(auto.result.isError).toBe(false)
    expect(calls[0]).toEqual(['a1', 'auto', 'x', false, { difficulty: 'hard', force: false }])
    const wrong = await (await post(rpc('tools/call', { name: 'delegate_task', arguments: { task: 'x', difficulty: 'imposible' } }))).json()
    expect(wrong.result.isError).toBe(true)
    const none = await (await post(rpc('tools/call', { name: 'delegate_task', arguments: { task: 'x' } }))).json()
    expect(none.result.isError).toBe(true)
  })

  it('propose_roles y confirm_roles pasan quién llama y los roles tal cual; los errores llegan como isError', async () => {
    const { post } = await start()
    const roles = [{ id: 'api', name: 'API', responsibility: 'x', deliverables: ['y'], done: 'z', difficulty: 'easy' }]
    const ok = await (await post(rpc('tools/call', { name: 'propose_roles', arguments: { summary: ' plan ', roles } }))).json()
    expect(ok.result.isError).toBe(false)
    expect(calls[0]).toEqual(['a1', 'propose', 'plan', roles])
    const bad = await (await post(rpc('tools/call', { name: 'propose_roles', arguments: {} }))).json()
    expect(bad.result.isError).toBe(true)
    const confirmed = await (await post(rpc('tools/call', { name: 'confirm_roles', arguments: {} }))).json()
    expect(confirmed.result.isError).toBe(false)
    expect(calls[2]).toEqual(['a1', 'confirm'])
  })

  it('las instrucciones explican el flujo de roles', async () => {
    const { post } = await start()
    const init = await (await post(rpc('initialize'))).json()
    expect(init.result.instructions).toContain('propose_roles')
    expect(init.result.instructions).toContain('confirm_roles')
  })

  it('read_agent_output y wait_agent', async () => {
    const { post } = await start()
    const read = await (await post(rpc('tools/call', { name: 'read_agent_output', arguments: { agent_id: 'a2' } }))).json()
    expect(JSON.parse(read.result.content[0].text).text).toBe('listo')
    const waited = await (await post(rpc('tools/call', { name: 'wait_agent', arguments: { agent_id: 'a2', quiet_seconds: 2 } }))).json()
    expect(JSON.parse(waited.result.content[0].text).finished).toBe(true)
    const none = await (await post(rpc('tools/call', { name: 'read_agent_output', arguments: { agent_id: 'zz' } }))).json()
    expect(none.result.isError).toBe(true)
  })

  it('report_done valida estado y resumen y pasa quién avisa; retry_role pasa el rol', async () => {
    const { post } = await start()
    const ok = await (await post(rpc('tools/call', { name: 'report_done', arguments: { status: 'blocked', summary: ' falta la clave ', files_changed: ['src/a.ts', 3, ' '] } }))).json()
    expect(ok.result.isError).toBe(false)
    expect(calls[0]).toEqual(['a1', 'report', { status: 'blocked', summary: 'falta la clave', files: ['src/a.ts'] }])
    const badStatus = await (await post(rpc('tools/call', { name: 'report_done', arguments: { status: 'ok', summary: 'x' } }))).json()
    expect(badStatus.result.isError).toBe(true)
    const noSummary = await (await post(rpc('tools/call', { name: 'report_done', arguments: { status: 'done' } }))).json()
    expect(noSummary.result.isError).toBe(true)
    expect(calls).toHaveLength(1)
    const retried = await (await post(rpc('tools/call', { name: 'retry_role', arguments: { role_id: 'api' } }))).json()
    expect(retried.result.isError).toBe(false)
    const missing = await (await post(rpc('tools/call', { name: 'retry_role', arguments: { role_id: 'otro' } }))).json()
    expect(missing.result.isError).toBe(true)
  })

  it('get_role_result devuelve el resultado del rol o un error si no existe', async () => {
    const { post } = await start()
    const ok = await (await post(rpc('tools/call', { name: 'get_role_result', arguments: { role_id: ' api ' } }))).json()
    expect(JSON.parse(ok.result.content[0].text).summary).toBe('rutas hechas')
    const bad = await (await post(rpc('tools/call', { name: 'get_role_result', arguments: { role_id: 'otro' } }))).json()
    expect(bad.result.isError).toBe(true)
  })

  it('accept_role y reject_role pasan el rol; reject_role exige feedback', async () => {
    const { post } = await start()
    const ok = await (await post(rpc('tools/call', { name: 'accept_role', arguments: { role_id: 'api' } }))).json()
    expect(ok.result.isError).toBe(false)
    const bad = await (await post(rpc('tools/call', { name: 'accept_role', arguments: { role_id: 'otro' } }))).json()
    expect(bad.result.isError).toBe(true)
    const noFeedback = await (await post(rpc('tools/call', { name: 'reject_role', arguments: { role_id: 'api', feedback: '  ' } }))).json()
    expect(noFeedback.result.isError).toBe(true)
    const rejected = await (await post(rpc('tools/call', { name: 'reject_role', arguments: { role_id: 'api', feedback: ' faltan tests ' } }))).json()
    expect(rejected.result.isError).toBe(false)
    expect(calls).toEqual([['a1', 'accept', 'api'], ['a1', 'accept', 'otro'], ['a1', 'reject', 'api', 'faltan tests']])
  })

  it('ask_leader, answer_agent, post_note, read_notes y get_updates pasan quién llama; sin texto fallan', async () => {
    const { post } = await start()
    const call = async (name: string, args: object): Promise<{ isError: boolean; content: Array<{ text: string }> }> => (await (await post(rpc('tools/call', { name, arguments: args }))).json()).result
    expect((await call('ask_leader', { question: ' ¿qué formato? ' })).isError).toBe(false)
    expect((await call('ask_leader', { question: ' ' })).isError).toBe(true)
    expect((await call('answer_agent', { agent_id: 'a2', answer: ' JSON ' })).isError).toBe(false)
    expect((await call('answer_agent', { agent_id: 'a2' })).isError).toBe(true)
    expect((await call('post_note', { text: ' la API usa snake_case ' })).isError).toBe(false)
    expect((await call('post_note', {})).isError).toBe(true)
    expect((await call('read_notes', { limit: 9999 })).isError).toBe(false)
    expect(JSON.parse((await call('get_updates', {})).content[0].text).updates).toEqual(['para a1'])
    expect(calls).toEqual([['a1', 'ask', '¿qué formato?'], ['a1', 'answer', 'a2', 'JSON'], ['a1', 'note', 'la API usa snake_case'], ['a1', 'notes', 200]])
  })

  it('list_role_templates devuelve los roles reutilizables', async () => {
    const { post } = await start()
    const res = await (await post(rpc('tools/call', { name: 'list_role_templates', arguments: {} }))).json()
    expect(JSON.parse(res.result.content[0].text).templates[0].id).toBe('tests')
  })

  it('list_powers y use_power cargan un Power solo cuando se pide', async () => {
    const { post } = await start()
    const call = async (name: string, args: object): Promise<{ isError: boolean; content: Array<{ text: string }> }> => (await (await post(rpc('tools/call', { name, arguments: args }))).json()).result
    expect(JSON.parse((await call('list_powers', {})).content[0].text).powers[0].name).toBe('db')
    expect(JSON.parse((await call('use_power', { name: 'db' })).content[0].text).guide).toBe('usa pg')
    expect((await call('use_power', { name: 'nada' })).isError).toBe(true)
    expect((await call('use_power', {})).isError).toBe(true)          // sin nombre ni siquiera llega al host
    expect(calls).toEqual([['a1', 'power', 'db'], ['a1', 'power', 'nada']])
  })

  it('marca como conectado al agente que habla con el servidor', async () => {
    const { post } = await start()
    await post(rpc('initialize'))
    expect(seen.has('a1')).toBe(true)
  })

  it('wait_agent vuelve en cuanto el agente avisa con report_done, y avisa si espera un permiso', async () => {
    const { post } = await start()
    const done = JSON.parse((await (await post(rpc('tools/call', { name: 'wait_agent', arguments: { agent_id: 'a3', timeout_seconds: 5 } }))).json()).result.content[0].text)
    expect(done.finished).toBe(true)
    expect(done.report.summary).toBe('hecho')
    const asking = JSON.parse((await (await post(rpc('tools/call', { name: 'wait_agent', arguments: { agent_id: 'a4', timeout_seconds: 5 } }))).json()).result.content[0].text)
    expect(asking.finished).toBe(false)
    expect(asking.note).toMatch(/permiso/)
    const question = JSON.parse((await (await post(rpc('tools/call', { name: 'wait_agent', arguments: { agent_id: 'a5', timeout_seconds: 5 } }))).json()).result.content[0].text)
    expect(question.finished).toBe(false)
    expect(question.note).toMatch(/answer_agent/)
  })

  it('acepta los argumentos como texto JSON (algunos modelos los mandan así)', async () => {
    const { post } = await start()
    const res = await (await post(rpc('tools/call', { name: 'post_note', arguments: '{"text":"nota"}' }))).json()
    expect(res.result.isError).toBe(false)
    expect(calls[0]).toEqual(['a1', 'note', 'nota'])
  })

  it('acepta lotes JSON-RPC', async () => {
    const { post } = await start()
    const replies = await (await post([rpc('ping', {}, 1), rpc('ping', {}, 2)])).json()
    expect(replies).toHaveLength(2)
  })
})
