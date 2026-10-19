import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadPlan, parseRoles, removePlan, rolePrompt, rolesFile, savePlan, settleInflight, type RolePlan } from '../../../../src/main/services/agents/rolePlan'
import type { Role } from '../../../../src/main/services/agents/roles'

const role = (patch: Partial<Role>): Role => ({
  id: 'api', name: 'API', responsibility: 'Endpoints', deliverables: ['rutas'], done: 'las rutas responden', files: ['src/api'], difficulty: 'medium', dependsOn: [], ...patch
})
const dirs: string[] = []
const project = (): string => { const d = mkdtempSync(join(tmpdir(), 'tutti-roles-')); dirs.push(d); return d }
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

describe('roles que llegan de un agente', () => {
  it('limpia lo que viene sin fiar', () => {
    const [r] = parseRoles([{ id: ' api ', name: 'API', responsibility: 'x', deliverables: ['a', 3, ' '], done: 'ok', files: 'no-es-lista', difficulty: 'hard', dependsOn: ['db', null] }])
    expect(r).toMatchObject({ id: 'api', deliverables: ['a'], files: [], difficulty: 'hard', dependsOn: ['db'] })
  })
  it('conserva el agente y el modelo elegidos a mano, y descarta lo vacío', () => {
    const [a, b, c] = parseRoles([{ ...role({}), assign: { agent: ' a1 ', model: ' opus ' } }, { ...role({}), assign: { agent: '', model: 'x' } }, { ...role({}), assign: { agent: 'codex' } }])
    expect(a.assign).toEqual({ agent: 'a1', model: 'opus' })
    expect(b.assign).toBeUndefined()
    expect(c.assign).toEqual({ agent: 'codex' })
  })
  it('lo que no es una lista o un objeto queda vacío para que la validación lo señale', () => {
    expect(parseRoles('nada')).toEqual([])
    expect(parseRoles(JSON.stringify([{ id: 'api' }]))[0].id).toBe('api')
    expect(parseRoles([null])[0]).toMatchObject({ id: '', name: '', deliverables: [] })
  })
})

describe('plan guardado en .tutti/roles.json', () => {
  it('se guarda y se vuelve a leer igual', () => {
    const p = project()
    const plan: RolePlan = { summary: 'Migrar', status: 'reviewed', roles: [role({ id: 'db', files: ['src/db'] }), role({ dependsOn: ['db'] })], done: ['db'] }
    expect(savePlan(p, plan)).toBe(true)
    expect(rolesFile(p)).toBe(join(p, '.tutti', 'roles.json'))
    expect(loadPlan(p)).toEqual(plan)
  })
  it('lo elegido a mano sobrevive al guardar y leer', () => {
    const p = project()
    const plan: RolePlan = { summary: '', status: 'proposed', roles: [role({ assign: { agent: 'a1', model: 'opus' } })], done: [] }
    savePlan(p, plan)
    expect(loadPlan(p)?.roles[0].assign).toEqual({ agent: 'a1', model: 'opus' })
  })
  it('se puede borrar, y borrar lo que no existe no falla', () => {
    const p = project()
    savePlan(p, { summary: '', status: 'proposed', roles: [role({})], done: [] })
    removePlan(p)
    expect(loadPlan(p)).toBeNull()
    expect(() => removePlan(p)).not.toThrow()
  })
  it('sin archivo, roto o con roles inválidos no hay plan', () => {
    const p = project()
    expect(loadPlan(p)).toBeNull()
    savePlan(p, { summary: '', status: 'proposed', roles: [role({})], done: [] })
    writeFileSync(rolesFile(p), '{no es json', 'utf8')
    expect(loadPlan(p)).toBeNull()
    writeFileSync(rolesFile(p), JSON.stringify({ roles: [role({ dependsOn: ['nada'] })] }), 'utf8')
    expect(loadPlan(p)).toBeNull()
  })
  it('un estado desconocido vale como propuesto y los «hechos» que no existen se ignoran', () => {
    const p = project()
    savePlan(p, { summary: '', status: 'proposed', roles: [role({})], done: [] })
    const raw = JSON.parse(readFileSync(rolesFile(p), 'utf8'))
    writeFileSync(rolesFile(p), JSON.stringify({ ...raw, status: 'raro', done: ['api', 'fantasma'] }), 'utf8')
    expect(loadPlan(p)).toMatchObject({ status: 'proposed', done: ['api'] })
  })
})

describe('resultados de los roles', () => {
  it('se guardan y se leen; los de roles que no existen o con estado raro se ignoran', () => {
    const p = project()
    const results = { api: { status: 'done' as const, summary: 'rutas hechas', files: ['src/api/a.ts'], agent: 'Claude Code', at: 5 } }
    savePlan(p, { summary: '', status: 'approved', roles: [role({})], done: ['api'], results })
    expect(loadPlan(p)?.results).toEqual(results)
    const raw = JSON.parse(readFileSync(rolesFile(p), 'utf8'))
    writeFileSync(rolesFile(p), JSON.stringify({ ...raw, results: { ...raw.results, fantasma: { status: 'done', summary: 'x' }, api: { status: 'raro' } } }), 'utf8')
    expect(loadPlan(p)?.results).toBeUndefined()
  })
  it('un plan sin resultados se lee sin ellos', () => {
    const p = project()
    savePlan(p, { summary: '', status: 'proposed', roles: [role({})], done: [] })
    expect(loadPlan(p)?.results).toBeUndefined()
  })
})

describe('comprobación y revisión', () => {
  it('el check del rol se guarda y uno vacío no cuenta', () => {
    const p = project()
    savePlan(p, { summary: '', status: 'proposed', roles: [role({ check: 'npm test' })], done: [] })
    expect(loadPlan(p)?.roles[0].check).toBe('npm test')
    expect(parseRoles([{ ...role({}), check: '  ' }])[0].check).toBeUndefined()
  })
  it('las revisiones pendientes se guardan; las de roles ya aceptados o que no existen se ignoran', () => {
    const p = project()
    const review = { api: { agentId: 'a3', agent: 'Codex', command: 'codex', check: { command: 'npm test', ok: false, output: '1 failed' }, outside: ['src/db/x.ts'], at: 7 } }
    savePlan(p, { summary: '', status: 'approved', roles: [role({}), role({ id: 'db', name: 'Datos', files: ['src/db'] })], done: [], review })
    expect(loadPlan(p)?.review).toEqual(review)
    const raw = JSON.parse(readFileSync(rolesFile(p), 'utf8'))
    writeFileSync(rolesFile(p), JSON.stringify({ ...raw, done: ['api'], review: { ...raw.review, fantasma: { agentId: 'a9' } } }), 'utf8')
    expect(loadPlan(p)?.review).toBeUndefined()
  })
})

describe('roles a medias al reiniciar', () => {
  const base = (): RolePlan => ({ summary: '', status: 'approved', roles: [role({}), role({ id: 'db', name: 'Datos', files: ['src/db'] })], done: [] })
  it('lo que estaba en marcha se guarda y se vuelve a leer', () => {
    const p = project()
    savePlan(p, { ...base(), inflight: { api: { agent: 'Codex', at: 3 } } })
    expect(loadPlan(p)?.inflight).toEqual({ api: { agent: 'Codex', at: 3 } })
  })
  it('al asentarlo, cada rol en marcha pasa a «falló» con un resumen que lo explica y conserva sus archivos', () => {
    const plan: RolePlan = { ...base(), inflight: { api: { agent: 'Codex', at: 3 } }, results: { api: { status: 'blocked', summary: 'x', files: ['src/api/a.ts'], agent: 'Codex', at: 1 } } }
    expect(settleInflight(plan, 10)).toBe(true)
    expect(plan.inflight).toBeUndefined()
    expect(plan.results?.api).toMatchObject({ status: 'failed', files: ['src/api/a.ts'], agent: 'Codex', at: 10 })
    expect(plan.results?.api.summary).toMatch(/se cerró mientras Codex/)
  })
  it('los ya aceptados o en revisión no se tocan', () => {
    const plan: RolePlan = { ...base(), done: ['api'], review: { db: { agentId: 'a2', agent: 'A', command: 'a', outside: [], at: 1 } }, inflight: { api: { agent: 'A', at: 1 }, db: { agent: 'A', at: 1 } } }
    expect(settleInflight(plan)).toBe(false)
    expect(plan.results).toBeUndefined()
  })
})

describe('tiempos de los roles', () => {
  it('se guardan y se leen; los de roles que no existen o sin inicio se ignoran', () => {
    const p = project()
    savePlan(p, { summary: '', status: 'approved', roles: [role({})], done: [], times: { api: { start: 5, end: 9 } } })
    expect(loadPlan(p)?.times).toEqual({ api: { start: 5, end: 9 } })
    const raw = JSON.parse(readFileSync(rolesFile(p), 'utf8'))
    writeFileSync(rolesFile(p), JSON.stringify({ ...raw, times: { api: { end: 3 }, fantasma: { start: 1 } } }), 'utf8')
    expect(loadPlan(p)?.times).toBeUndefined()
  })
})

describe('lo que recibe el agente de un rol', () => {
  const plan: RolePlan = { summary: 'Añadir pagos', status: 'approved', roles: [role({ id: 'db', name: 'Datos', files: ['src/db'] }), role({ dependsOn: ['db'] })], done: [] }
  it('lleva su responsabilidad, entregables, criterio y archivos propios', () => {
    const text = rolePrompt(plan.roles[1], plan)
    expect(text).toContain('[Rol «API» (api)]')
    expect(text).toContain('Plan: Añadir pagos')
    expect(text).toContain('- rutas')
    expect(text).toContain('Criterio de terminado: las rutas responden')
    expect(text).toContain('solo editas estos): src/api')
    expect(text).toContain('de los que dependes: db')
  })
  it('nombra a los demás roles para que no toque sus archivos', () => {
    expect(rolePrompt(plan.roles[1], plan)).toContain('- db: Datos (src/db)')
  })
  it('lleva el resumen, los archivos y los cambios de los roles de los que depende', () => {
    const done: RolePlan = { ...plan, done: ['db'], results: { db: { status: 'done', summary: 'tabla pagos creada', files: ['migrations/1.sql'], agent: 'Codex', at: 1 } } }
    const text = rolePrompt(done.roles[1], done, { db: ' src/db/pagos.ts | 12 ++++' })
    expect(text).toContain('- db (Datos): tabla pagos creada')
    expect(text).toContain('Archivos: src/db, migrations/1.sql')
    expect(text).toContain('src/db/pagos.ts | 12 ++++')
  })
  it('sin resumen de la dependencia lo dice', () => {
    expect(rolePrompt(plan.roles[1], plan)).toContain('no dejó resumen')
  })
  it('un reintento lleva lo que pasó en el intento anterior', () => {
    const failed: RolePlan = { ...plan, results: { api: { status: 'failed', summary: 'falta la clave de Stripe', files: ['src/api/pay.ts'], agent: 'OpenCode', at: 1 } } }
    const text = rolePrompt(failed.roles[1], failed)
    expect(text).toContain('ya se intentó antes y falló (OpenCode): falta la clave de Stripe')
    expect(text).toContain('Tocó: src/api/pay.ts')
    expect(rolePrompt(plan.roles[1], plan)).not.toContain('ya se intentó')
  })
  it('si el rol tiene comprobación, se la dice', () => {
    expect(rolePrompt(role({ check: 'npm test -- api' }), plan)).toContain('ejecutará `npm test -- api`')
    expect(rolePrompt(role({}), plan)).not.toContain('ejecutará')
  })
  it('un rol sin archivos solo lee', () => {
    expect(rolePrompt(role({ files: [] }), plan)).toContain('no edites nada')
  })
})
