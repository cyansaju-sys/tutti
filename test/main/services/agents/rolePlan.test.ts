import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadPlan, parseRoles, removePlan, rolePrompt, rolesFile, savePlan, type RolePlan } from '../../../../src/main/services/agents/rolePlan'
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
  it('un rol sin archivos solo lee', () => {
    expect(rolePrompt(role({ files: [] }), plan)).toContain('no edites nada')
  })
})
