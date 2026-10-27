/**
 * Une el servidor MCP con los agentes abiertos: arranca el servidor, atiende sus herramientas y lleva el ritmo (cada 2 s) de las tareas,
 * los avisos y los planes de roles. Lo de cada parte vive en su módulo: tasks.ts (tareas delegadas), inbox.ts (avisos), leader.ts (líder),
 * candidates.ts (a quién repartir), plans.ts (plan de roles), history.ts (historial) y roleTemplates.ts (roles reutilizables).
 */
import type { BrowserWindow } from 'electron'
import type { AppMcpInfo, OpenPane, PaneRole, PaneState } from '../../../shared/types'
import { execFileSync } from 'node:child_process'
import { detectAgents } from './agents'
import { capable, capableFor, exhausted, isDifficulty, pickAgent, type Difficulty } from './assign'
import { candidates, nameOf, quotaOf } from './candidates'
import { readContext } from '../context/context'
import { projectRoot } from '../context/projectRoot'
import { codexConfig } from '../mcp/mcp'
import { dropCodexBridgeCopy } from '../mcp/mirror'
import { launchServers } from '../mcp/sync'
import { agyBridgeStatus, ensureAgyBridge } from './agyBridge'
import { trackRecord } from './history'
import { deliverNotices, noticeCounts, notify, takeNotices } from './inbox'
import { awaitingInput, buildLaunch, parseMajor, PROMPT_ARGS, taskShown } from './launch'
import { chooseLeader, currentLeader } from './leader'
import { availableModels, currentModel, MODEL_FLAG, tier } from './models'
import { appendNote, readNotes } from './notes'
import { powerGuide, powerSummaries } from '../powers'
import { listPlanTemplates, planTemplateInfo } from './planTemplates'
import { Orchestra, TOOLS, type AgentOutput, type Host } from './orchestra'
import * as plans from './plans'
import * as pty from './pty'
import { listTemplates } from './roleTemplates'
import { appWindow, busy, BUSY_SECONDS, knownProjects, label, oneLine, setWindow, toast, toUi } from './runtime'
import { checkTasks, connected, forgetFinished, INPUT_ROWS, latestTaskOf, overLimit, recordTask, statusOf, tasks } from './tasks'
import { tm } from '../../utils/i18n'
import { getSetting } from '../settings'

// lo que usa la interfaz (index.ts) sigue saliendo de aquí
export { acceptRole, addRole, approveRoles, cancelRole, discardRoles, pauseRoles, planFromTemplate, rejectRole, removeRole, retryRole, roleOptions, rolesState, saveAsPlanTemplate, startRoles, updateRole } from './plans'
export { deletePlanTemplate } from './planTemplates'
/** Las plantillas de plan para elegirlas en la interfaz. */
export const planTemplates = (): ReturnType<typeof planTemplateInfo>[] => listPlanTemplates().map(planTemplateInfo)
export { taskList } from './tasks'
export { deleteTemplate as deleteRoleTemplate, listTemplates as roleTemplates, saveTemplate as saveRoleTemplate } from './roleTemplates'

let orchestra: Orchestra | null = null
let counter = 1
export const newId = (): string => `a${counter++}`

/** Quita del panel las tareas terminadas, después de anotar en su plan lo que acabó. */
export function clearTasks(): void {
  plans.syncAllPlans()
  forgetFinished()
}

/** El usuario elige otro líder: también pasa a dirigir los planes en marcha, y se le pone al día. */
export function setLeader(id: string): boolean {
  if (!chooseLeader(id)) return false
  plans.leadPlans(id)
  pushPaneState()
  return true
}

// --- lo que muestran las pestañas de los agentes ---
/** El rol que lleva cada panel de agente abierto: el de su última tarea, con el nombre que tiene en el plan. */
function paneRoles(): Record<string, PaneRole> {
  const out: Record<string, PaneRole> = {}
  for (const m of pty.agentSessions()) {
    const t = latestTaskOf(m.id)
    if (t?.role) out[m.id] = { id: t.role, name: plans.roleNameOf(t) ?? t.role, status: statusOf(t) }
  }
  return out
}
/** El líder (si hay más de un agente), el rol de cada panel y cuántos avisos de Tutti le esperan. */
export function paneState(): PaneState {
  return { leader: pty.agentSessions().length > 1 ? currentLeader()?.id ?? null : null, roles: paneRoles(), inbox: noticeCounts() }
}
let sentState = ''
/** Avisa a la interfaz cuando cambia algo de lo que muestran las pestañas. */
function pushPaneState(): void {
  const state = paneState()
  const json = JSON.stringify(state)
  if (json === sentState) return
  sentState = json
  toUi('orchestra:pane-state', state)
}

function describe(meta: pty.Meta, leaderId: string | undefined): Record<string, unknown> {
  const model = currentModel(meta.command, meta.cwd)
  const level = tier(model)
  return {
    id: meta.id, agent: meta.name, command: meta.command, model: model ?? 'desconocido', tier: level.tier, model_recognized: level.known,
    role: meta.id === leaderId ? 'líder' : meta.parentId ? `sub-agente de ${meta.parentId}` : 'trabajador',
    status: busy(meta.id) ? 'ocupado' : 'libre', project: meta.cwd, track_record: trackRecord(meta.command, model)
  }
}

/**
 * Entrega la tarea a los agentes que no la aceptan como argumento: se les escribe cuando su interfaz está lista y, si no aparece en su
 * pantalla una vez en reposo, se vuelve a enviar (como mucho dos veces). Los que la reciben como argumento no necesitan nada más.
 */
function deliverTask(id: string, task: string, viaArgs: boolean): void {
  if (viaArgs) return                    // ya la recibió como argumento al arrancar: reenviarla la duplicaba (el agente la contestaba varias veces)
  const deadline = Date.now() + 90_000
  let sent = -1                          // -1: aún no se ha escrito nada
  let rowsAtSend = 0                     // líneas que había al escribirla: si luego crecen mucho, el agente ya la atendió
  const timer = setInterval(() => {
    if (!pty.hasSession(id) || Date.now() > deadline) return clearInterval(timer)
    const screen = pty.screenText(id, 100_000)          // todo el historial: tras responder, el comienzo de la tarea sale de las últimas líneas
    if (!screen || pty.idleFor(id) < (sent <= 0 ? 2 : 4)) return          // interfaz sin lista o todavía trabajando
    if (sent >= 0 && taskShown(screen, task)) return clearInterval(timer)  // llegó
    if (sent > 0 && screen.split('\n').length - rowsAtSend > MIN_ANSWER_ROWS) return clearInterval(timer)          // la atendió aunque la pantalla no la muestre (p. ej. «[Pasted text]»)
    if (sent >= 2) return clearInterval(timer)                              // reintentos agotados
    pty.sendPrompt(id, task)
    rowsAtSend = screen.split('\n').length
    sent = Math.max(sent, 0) + 1
  }, 1000)
}
const MIN_ANSWER_ROWS = 4

const me = (caller: string): pty.Meta | undefined => pty.agentSessions().find((m) => m.id === caller)

const host: Host = {
  async listAgents(caller) {
    const open = pty.agentSessions()
    const leader = currentLeader()
    const project = leader?.cwd
    return {
      open_agents: await Promise.all(open.map(async (m) => ({ ...describe(m, leader?.id), quota_used_percent: (await quotaOf(m.command)) ?? 'desconocido', available_models: await availableModels(m.command, detectAgents().find((a) => a.command === m.command)?.path, m.cwd) }))),
      installed_agents: await Promise.all(detectAgents().map(async (a) => {
        const model = project ? currentModel(a.command, project) : null
        const level = tier(model).tier
        return { agent: a.name, command: a.command, last_model: model ?? 'desconocido', tier: level, can_handle: capableFor({ tier: level }), available_models: await availableModels(a.command, a.path, project), quota_used_percent: (await quotaOf(a.command)) ?? 'desconocido', track_record: trackRecord(a.command, model) }
      })),
      you_are: caller, lead: leader?.id ?? null
    }
  },

  reported(agentId) {
    for (const t of tasks) if (t.agentId === agentId) t.notified = true
  },

  seen(caller) { connected.add(caller) },

  report(caller, report) {
    // la pendiente más reciente; si ya avisó de todas, se actualiza la última (p. ej. estaba bloqueado, el usuario le respondió en su panel y ahora terminó)
    const t = [...tasks].reverse().find((x) => x.agentId === caller && !x.report) ?? latestTaskOf(caller)
    if (!t) return { ok: true, info: 'No hace falta: nadie te pasó una tarea con delegate_task ni un rol, así que no hay a quién avisar. Si la tarea te la dio el usuario, contéstale a él directamente.' }
    t.report = report
    t.endedAt = Date.now()
    t.notified = false          // si ya se avisó al líder por el silencio, ahora recibe el resumen
    plans.recordRoleResult(t)
    return { ok: true, info: report.status === 'blocked' ? 'Recibido: la app avisa a quien te pasó la tarea. Espera su respuesta.' : 'Recibido: la app avisa a quien te pasó la tarea.' }
  },

  roleResult: (caller, roleId) => plans.roleResultFor(caller, roleId),
  acceptRole: (caller, roleId) => plans.acceptRoleBy(caller, roleId),
  rejectRole: (caller, roleId, feedback) => plans.rejectRoleBy(caller, roleId, feedback),
  retryRole: (caller, roleId) => plans.retryRoleBy(caller, roleId),

  roleTemplates() {
    const list = listTemplates()
    return { ok: true, info: list.length ? { templates: list } : 'El usuario aún no guardó roles reutilizables.' }
  },

  listPowers(caller) {
    const who = me(caller)
    const list = powerSummaries(who ? projectRoot(who.cwd, knownProjects()) : null)
    return { ok: true, info: list.length ? { powers: list } : 'No hay Powers instalados.' }
  },

  async usePower(caller, name) {
    const who = me(caller)
    return powerGuide(who ? projectRoot(who.cwd, knownProjects()) : null, name)
  },

  askLeader(caller, question) {
    const t = [...tasks].reverse().find((x) => x.agentId === caller && !x.report)
    if (!t) return { ok: false, info: 'ask_leader es para preguntar a quien te pasó una tarea, y no tienes ninguna pendiente. Si la tarea te la dio el usuario, pregúntale a él directamente.' }
    t.asking = { question, at: Date.now() }
    notify(t.callerId, `[Tutti] ${t.agent} (${t.agentId})${t.role ? `, con el rol ${t.role},` : ''} pregunta sobre la tarea «${oneLine(t.task, 80)}»:\n${question}\nContéstale con answer_agent(agent_id: "${t.agentId}", answer: ...).`)
    toast(tm('m.hub.asked', { agent: label(t.agent) }))
    return { ok: true, info: 'Pregunta enviada. Espera sin seguir con lo que dependa de ella: la respuesta te llegará escrita como «[Tutti] Respuesta…».' }
  },

  answerAgent(caller, agentId, answer) {
    if (!pty.hasSession(agentId)) return { ok: false, info: `${agentId} ya no está abierto.` }
    const t = latestTaskOf(agentId)
    const blocked = t?.report?.status === 'blocked'
    if (!t || (!t.asking && !blocked)) return { ok: false, info: `${agentId} no está esperando una respuesta. Para darle una tarea nueva usa delegate_task.` }
    if (t.callerId !== caller) return { ok: false, info: `Solo quien le pasó la tarea (${t.callerId}) le contesta.` }
    t.asking = undefined
    t.nudged = false
    if (blocked) { t.report = undefined; t.endedAt = null; t.notified = false }          // sigue con la misma tarea, no empieza otra
    const who = me(caller)
    pty.sendPrompt(agentId, `[Tutti] Respuesta de ${who ? label(who.name) : caller} a tu pregunta:\n${answer}\n\nSigue con tu tarea y, al acabarla, llama a report_done.`)
    return { ok: true, info: 'Respuesta enviada: sigue con su tarea y te aviso cuando acabe.' }
  },

  postNote(caller, text) {
    const who = me(caller)
    if (!who) return { ok: false, info: 'Solo los agentes abiertos en la app pueden dejar notas.' }
    const role = latestTaskOf(caller)?.role
    const author = `${label(who.name)} (${who.id}${role ? `, rol ${role}` : ''})`
    return appendNote(projectRoot(who.cwd, knownProjects()), author, text)
      ? { ok: true, info: 'Nota guardada en .tutti/notes.md: los demás la verán con read_notes.' }
      : { ok: false, info: 'No se pudo escribir .tutti/notes.md (¿proyecto de solo lectura?).' }
  },

  readNotes(caller, limit) {
    const who = me(caller)
    if (!who) return { ok: false, info: 'Solo los agentes abiertos en la app pueden leer las notas.' }
    const notes = readNotes(projectRoot(who.cwd, knownProjects()), limit)
    return { ok: true, info: notes.length ? { file: '.tutti/notes.md', notes } : 'Aún no hay notas en la pizarra del proyecto.' }
  },

  updates(caller) {
    const list = takeNotices(caller)
    return { ok: true, info: list.length ? { updates: list } : 'No tienes avisos pendientes.' }
  },

  async delegate(caller, requested, task, newInstance, opts = {}) {
    const open = pty.agentSessions()
    const self = open.find((m) => m.id === caller)
    if (!self) return { ok: false, info: 'Solo los agentes abiertos en la app pueden repartir tareas.' }
    // un plan revisado espera al usuario: hasta que lo apruebe, nadie reparte por su cuenta (los roles del propio plan sí pasan)
    if (!opts.role && plans.waitingApproval(self.cwd)) {
      return { ok: false, info: 'Hay un plan de roles esperando la aprobación del usuario. No repartas tareas hasta que la dé: la app lanzará los roles y te avisará con «[Tutti]».' }
    }
    let target = requested
    const difficulty: Difficulty | undefined = isDifficulty(opts.difficulty) ? opts.difficulty : undefined
    let assigned = ''
    if (difficulty) {
      // revisa el listado de agentes y comprueba que el elegido tenga capacidad para la tarea
      const list = await candidates(caller, self.cwd)
      const best = pickAgent(list, difficulty)
      if (!target || target.toLowerCase() === 'auto') {
        if (!best.chosen) return { ok: false, info: `No se pudo asignar: ${best.reason}.` }
        target = best.chosen.id ?? best.chosen.command
        assigned = `Asignado a ${nameOf(best.chosen)}: ${best.reason}.`
      } else if (!opts.force) {
        const wanted = target.toLowerCase()
        const match = list.find((c) => c.id === target) ?? list.find((c) => !c.id && (c.command.toLowerCase() === wanted || c.name.toLowerCase() === wanted))
        if (match && (!capable(match, difficulty) || exhausted(match))) {
          const why = exhausted(match) ? `agotó su límite de uso (${match.quota}%)` : `es de nivel ${match.tier} y la tarea es ${difficulty}`
          const alt = best.chosen && best.chosen !== match ? ` Mejor opción: ${nameOf(best.chosen)} (${best.reason}). Vuelve a llamar con ese agente, con agent "auto", o con force=true para mantener ${nameOf(match)}.` : ' Usa force=true para mantenerlo igualmente.'
          return { ok: false, info: `${nameOf(match)} ${why}.${alt}` }
        }
      }
    }
    if (target === caller) return { ok: false, info: 'No puedes delegarte una tarea a ti mismo.' }
    const full = overLimit(open.find((m) => m.id === target)?.id ?? null)
    if (full) return { ok: false, info: `No se reparte ahora: ${full}. Espera a que termine alguno (te aviso con «[Tutti]»), hazla tú o dásela a uno que ya esté trabajando.` }
    // modelo pedido: se comprueba que el agente lo ofrezca y que se pueda fijar al arrancar; uno abierto con otro modelo no sirve
    const model = opts.model
    let modelArgs: string[] = []
    if (model) {
      const openTarget = open.find((m) => m.id === target)
      const command = openTarget?.command ?? detectAgents().find((a) => a.command.toLowerCase() === target.toLowerCase() || a.name.toLowerCase() === target.toLowerCase())?.command
      if (!command) return { ok: false, info: `No conozco el agente '${target}'. Usa list_agents para ver los disponibles.` }
      const flag = MODEL_FLAG[command]
      if (!flag) return { ok: false, info: `${command} no permite elegir el modelo al abrirlo desde aquí. Cámbialo a mano en su panel o pide otro agente (con model: ${Object.keys(MODEL_FLAG).join(', ')}).` }
      const offered = await availableModels(command, detectAgents().find((a) => a.command === command)?.path, openTarget?.cwd ?? currentLeader()?.cwd)
      if (offered.length && !offered.some((m) => m.id === model)) return { ok: false, info: `${command} no ofrece el modelo '${model}'. Disponibles: ${offered.map((m) => m.id).join(', ')}.` }
      modelArgs = [flag, model]
      if (openTarget) {
        if ((currentModel(command, openTarget.cwd) ?? '').includes(model)) modelArgs = []      // ya usa ese modelo
        else { target = command; newInstance = true }
      } else newInstance = true
    }
    const leader = currentLeader()
    let pane = open.find((m) => m.id === target)
    if (!pane) {
      const wanted = target.toLowerCase()
      const match = detectAgents().find((a) => a.command.toLowerCase() === wanted || a.name.toLowerCase() === wanted)
      if (!match) return { ok: false, info: `No conozco el agente '${target}'. Usa list_agents para ver los disponibles.` }
      // uno libre del mismo tipo, que no sea quien pide ni el líder (no se le quita el trabajo al líder)
      if (!newInstance) pane = open.find((m) => m.id !== caller && m.id !== leader?.id && m.command === match.command && !busy(m.id))
      if (!pane) {
        const win = appWindow()
        if (!win) return { ok: false, info: 'No se pudo abrir el agente: la ventana no está disponible.' }
        const id = newId()
        const request: OpenPane = { id, name: match.name, command: match.command, args: [...(match.args ?? []), ...modelArgs], cwd: self.cwd, prompt: task, parentId: caller }
        win.webContents.send('orchestra:open-pane', request)         // la interfaz crea su panel; la terminal inicia el proceso
        if (!(await pty.waitForSpawn(id, 20_000))) return { ok: false, info: `No se pudo abrir ${match.name}: no arrancó a tiempo.` }
        plans.noteRoleTask(recordTask(self, id, match.name, match.command, task, { difficulty, model, role: opts.role }))
        toast(tm('m.hub.opened', { leader: label(self.name), agent: match.name }))
        return { ok: true, info: { agent_id: id, message: `${assigned} Abrí ${match.name}${model ? ` con el modelo ${model}` : ''} en su propio panel con la tarea. Usa wait_agent para esperar su resultado.`.trim() } }
      }
    }
    pty.sendPrompt(pane.id, task)
    plans.noteRoleTask(recordTask(self, pane.id, pane.name, pane.command, task, { difficulty, model, role: opts.role }))
    toast(tm('m.hub.delegated', { leader: label(self.name), agent: label(pane.name) }))
    return { ok: true, info: { agent_id: pane.id, message: `${assigned} Tarea enviada. Usa wait_agent para esperar su resultado.`.trim() } }
  },

  proposeRoles: (caller, summary, input) => plans.proposePlan(caller, summary, input),
  confirmRoles: (caller) => plans.confirmPlan(caller, host.delegate),

  output(agentId, lines): AgentOutput | null {
    if (!pty.hasSession(agentId)) return null
    const idle = pty.idleFor(agentId)
    const latest = latestTaskOf(agentId)
    const report = latest?.report          // solo el de su última tarea: el de una anterior no dice nada de la actual
    const question = latest?.asking?.question
    const asking = idle >= BUSY_SECONDS && awaitingInput(pty.screenText(agentId, INPUT_ROWS))
    return { agent_id: agentId, busy: idle < BUSY_SECONDS, idle_seconds: Math.round(idle * 10) / 10, text: pty.screenText(agentId, Math.max(5, Math.min(lines, 400))), ...(report ? { report } : {}), ...(asking ? { awaiting_input: true } : {}), ...(question ? { question } : {}) }
  }
}

let ticker: ReturnType<typeof setInterval> | null = null
/** Cada 2 s: sigue las tareas, entrega los avisos, actualiza las pestañas y avanza los planes. */
function tick(): void {
  checkTasks(plans.byReview)
  deliverNotices()
  pushPaneState()
  void plans.tickRoles(host.delegate).catch(() => undefined)
}

/** Arranca el servidor de reparto de tareas (se desactiva con `"orchestration": false` en los ajustes). */
export async function startHub(window: () => BrowserWindow | null): Promise<void> {
  setWindow(window)
  // el gancho va siempre: sin servidor de reparto de tareas los agentes siguen recibiendo el contexto del proyecto
  pty.setLaunchHook((opts): pty.Launch => {
    const entry = orchestra?.configFor(opts.id) ?? null
    if (entry && opts.command === 'agy') ensureAgyBridge()
    if (entry && opts.command === 'codex') dropCodexBridgeCopy(codexConfig())      // una copia stdio de «tutti» impide pasarle el suyo por -c
    const prompt = opts.prompt?.trim()
    const root = opts.cwd ? projectRoot(opts.cwd, knownProjects()) : null
    const context = root ? readContext(root) ?? undefined : undefined
    const project = opts.command === 'opencode' && root ? launchServers(root) : []          // los MCP del .mcp.json, en lugar de un opencode.json
    const launch = buildLaunch(opts.command, entry, prompt, opts.args ?? [], opts.command === 'opencode' ? opencodeMajor() : 2, context, project)
    // los agentes que no aceptan la tarea como argumento la reciben escrita cuando su interfaz está lista
    const after = prompt ? () => deliverTask(opts.id, prompt, !!PROMPT_ARGS[opts.command]) : undefined
    return { ...launch, after }
  })
  if (getSetting('orchestration') === false) return
  if (detectAgents().some((a) => a.command === 'agy')) ensureAgyBridge()      // renueva la ruta del puente si la app cambió de sitio
  ticker ??= setInterval(tick, 2000)
  try { orchestra = await new Orchestra(host).start() } catch { /* sin servidor local la app funciona igual */ }
}

let majorCache: number | null = null
/** Versión principal de OpenCode instalada (cambia cómo se le conecta el MCP). */
function opencodeMajor(): number {
  if (majorCache === null) {
    const exe = detectAgents().find((a) => a.command === 'opencode')?.path
    try { majorCache = exe ? parseMajor(execFileSync(exe, ['--version'], { encoding: 'utf8', timeout: 4000 })) : 2 } catch { majorCache = 2 }
  }
  return majorCache
}

export const stopHub = (): void => { orchestra?.stop(); if (ticker) clearInterval(ticker); ticker = null }

/** Configuración MCP de un agente (para las pruebas); null si el servidor no arrancó. */
export const orchestraConfig = (id: string): ReturnType<Orchestra['configFor']> | null => orchestra?.configFor(id) ?? null

/** El servidor MCP de la app y a qué agentes se aplica (lo que muestra la sección global de MCP). */
export function appMcpInfo(): AppMcpInfo {
  const installed = new Set(detectAgents().map((a) => a.command))
  const on = orchestra !== null
  const per = (command: string, name: string, how = tm('m.hub.appOnOpen')): AppMcpInfo['agents'][number] => ({ command, name, installed: installed.has(command), applied: on && installed.has(command), how })
  const agy = agyBridgeStatus()
  return {
    running: on, tools: TOOLS.map((t) => t.name),
    agents: [
      per('claude', 'Claude Code'),
      per('opencode', 'OpenCode'),
      { ...per('agy', 'Antigravity', tm('m.hub.agyHow')), applied: on && installed.has('agy') && agy.ok, problem: agy.ok ? undefined : agy.problem },
      per('codex', 'Codex'),
      { command: 'gemini', name: 'Gemini CLI', installed: installed.has('gemini'), applied: false, how: tm('m.hub.notSupported') }
    ]
  }
}
