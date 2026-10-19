import { describe, expect, it } from 'vitest'
import { assignRoles, outsideFiles, modelFor, reviewWarnings, validateRoles, type Role, type RoleCandidate } from '../../../../src/main/services/agents/roles'

const role = (patch: Partial<Role>): Role => ({
  id: 'api', name: 'API', responsibility: 'Endpoints', deliverables: ['rutas'], done: 'las rutas responden', files: [], difficulty: 'medium', dependsOn: [], ...patch
})
const cand = (patch: Partial<RoleCandidate>): RoleCandidate => ({ name: 'X', command: 'x', tier: 'standard', busy: false, ...patch })

describe('validación de roles', () => {
  it('acepta unos roles bien formados', () => {
    expect(validateRoles([role({ id: 'db', files: ['src/db'] }), role({ id: 'api', files: ['src/api'], dependsOn: ['db'] })])).toEqual([])
  })
  it('rechaza lo vacío y lo incompleto', () => {
    expect(validateRoles([])).toHaveLength(1)
    const errors = validateRoles([role({ name: '', done: '', deliverables: [], responsibility: ' ' })])
    expect(errors).toHaveLength(4)
  })
  it('rechaza ids repetidos o mal escritos y dificultades inválidas', () => {
    expect(validateRoles([role({ id: 'a' }), role({ id: 'a' })])).toEqual([expect.stringContaining('repetido')])
    expect(validateRoles([role({ id: 'Mal Id' })])[0]).toContain('id')
    expect(validateRoles([role({ difficulty: 'huge' as never })])[0]).toContain('dificultad')
  })
  it('rechaza dependencias que no existen, a sí mismo o en ciclo', () => {
    expect(validateRoles([role({ dependsOn: ['nada'] })])[0]).toContain('no existe')
    expect(validateRoles([role({ dependsOn: ['api'] })])[0]).toContain('sí mismo')
    expect(validateRoles([role({ id: 'a', dependsOn: ['b'] }), role({ id: 'b', dependsOn: ['a'] })])).toEqual([expect.stringContaining('ciclo')])
  })
  it('rechaza roles que editan los mismos archivos, también una carpeta y lo de dentro', () => {
    expect(validateRoles([role({ id: 'a', files: ['src/x.ts'] }), role({ id: 'b', files: ['./src/x.ts'] })])).toHaveLength(1)
    expect(validateRoles([role({ id: 'a', files: ['src/api/'] }), role({ id: 'b', files: ['src/api/routes.ts'] })])).toHaveLength(1)
    expect(validateRoles([role({ id: 'a', files: ['src/api/**'] }), role({ id: 'b', files: ['src/apiv2'] })])).toEqual([])
    expect(validateRoles([role({ id: 'a' }), role({ id: 'b' })])).toEqual([])          // sin archivos = solo lee
  })
})

describe('modelo según la dificultad', () => {
  const models = [{ id: 'haiku', tier: 'basic' as const }, { id: 'sonnet', tier: 'standard' as const }, { id: 'opus', tier: 'advanced' as const }]
  it('el justo para la tarea, no el más grande', () => {
    expect(modelFor(models, 'easy')?.id).toBe('haiku')
    expect(modelFor(models, 'medium')?.id).toBe('sonnet')
    expect(modelFor(models, 'hard')?.id).toBe('opus')
  })
  it('si ninguno llega, el más capaz; sin modelos, null', () => {
    expect(modelFor(models.slice(0, 2), 'hard')?.id).toBe('sonnet')
    expect(modelFor([], 'easy')).toBeNull()
  })
})

describe('asignación de roles a agentes', () => {
  it('cada rol va al agente que le corresponde por nivel', () => {
    const r = assignRoles(
      [role({ id: 'arq', difficulty: 'hard' }), role({ id: 'doc', difficulty: 'easy' })],
      [cand({ id: 'a1', tier: 'advanced' }), cand({ id: 'a2', tier: 'basic' })]
    )
    expect(r.map((x) => [x.role.id, x.agent?.id, x.status])).toEqual([['arq', 'a1', 'assigned'], ['doc', 'a2', 'assigned']])
  })
  it('un agente abierto nunca recibe dos roles', () => {
    const r = assignRoles([role({ id: 'a' }), role({ id: 'b' })], [cand({ id: 'a1' })])
    expect(r.filter((x) => x.status === 'assigned')).toHaveLength(1)
    expect(r.find((x) => x.status === 'queued')?.agent).toBeNull()
  })
  it('los roles difíciles escogen primero, aunque vengan al final', () => {
    const r = assignRoles(
      [role({ id: 'facil', difficulty: 'easy' }), role({ id: 'dificil', difficulty: 'hard' })],
      [cand({ id: 'a1', tier: 'advanced' })]
    )
    expect(r.find((x) => x.role.id === 'dificil')?.agent?.id).toBe('a1')
    expect(r.find((x) => x.role.id === 'facil')?.status).toBe('queued')
  })
  it('si el ideal está ocupado o sin cuota, el rol pasa a otro', () => {
    const busy = assignRoles([role({})], [cand({ id: 'a1', busy: true }), cand({ id: 'a2', tier: 'advanced' })])
    expect(busy[0].agent?.id).toBe('a2')
    const quota = assignRoles([role({})], [cand({ id: 'a1', quota: 97 }), cand({ id: 'a2', tier: 'advanced' })])
    expect(quota[0].agent?.id).toBe('a2')
  })
  it('si hay que abrir uno nuevo, puede abrirse varias veces el mismo agente', () => {
    const r = assignRoles([role({ id: 'a' }), role({ id: 'b' })], [cand({ command: 'codex', name: 'Codex' })])
    expect(r.map((x) => x.status)).toEqual(['assigned', 'assigned'])
  })
  it('al abrir uno nuevo fija el modelo con el nivel justo', () => {
    const models = [{ id: 'haiku', tier: 'basic' as const }, { id: 'opus', tier: 'advanced' as const }]
    const r = assignRoles([role({ difficulty: 'hard' })], [cand({ command: 'claude', tier: 'basic', models, canSetModel: true })])
    expect(r[0]).toMatchObject({ status: 'assigned', model: 'opus', downgraded: false })
  })
  it('un agente abierto no cambia de modelo', () => {
    const models = [{ id: 'opus', tier: 'advanced' as const }]
    expect(assignRoles([role({})], [cand({ id: 'a1', models, canSetModel: true })])[0].model).toBeNull()
  })
  it('si nadie llega al nivel, asigna al más capaz y lo marca', () => {
    const r = assignRoles([role({ difficulty: 'hard' })], [cand({ id: 'a1', tier: 'basic' }), cand({ id: 'a2', tier: 'standard' })])
    expect(r[0]).toMatchObject({ status: 'assigned', downgraded: true })
    expect(r[0].agent?.id).toBe('a2')
  })
  it('sin agentes válidos queda en cola, no se lo queda el líder', () => {
    expect(assignRoles([role({})], [])[0]).toMatchObject({ status: 'queued', agent: null })
    expect(assignRoles([role({})], [cand({ id: 'a1', quota: 99 })])[0].status).toBe('queued')
  })
  it('los roles con dependencias esperan hasta que terminen', () => {
    const roles = [role({ id: 'db' }), role({ id: 'api', dependsOn: ['db'] })]
    const first = assignRoles(roles, [cand({ id: 'a1' }), cand({ id: 'a2' })])
    expect(first.find((x) => x.role.id === 'api')).toMatchObject({ status: 'waiting', waitingOn: ['db'], agent: null })
    const later = assignRoles(roles, [cand({ id: 'a1' }), cand({ id: 'a2' })], { done: new Set(['db']) })
    expect(later).toHaveLength(1)
    expect(later[0]).toMatchObject({ role: { id: 'api' }, status: 'assigned' })
  })
  it('lo elegido a mano se respeta, con su modelo, y reserva el agente antes que el reparto automático', () => {
    const roles = [role({ id: 'auto', difficulty: 'hard' }), role({ id: 'manual', difficulty: 'easy', assign: { agent: 'a1', model: 'haiku' } })]
    const r = assignRoles(roles, [cand({ id: 'a1', tier: 'advanced' }), cand({ id: 'a2', tier: 'advanced' })])
    expect(r.find((x) => x.role.id === 'manual')).toMatchObject({ status: 'assigned', model: 'haiku', downgraded: false })
    expect(r.find((x) => x.role.id === 'manual')?.agent?.id).toBe('a1')
    expect(r.find((x) => x.role.id === 'auto')?.agent?.id).toBe('a2')
  })
  it('un agente por abrir se elige a mano por su comando o su nombre', () => {
    const r = assignRoles([role({ assign: { agent: 'Codex' } })], [cand({ command: 'codex', name: 'Codex' }), cand({ id: 'a1', tier: 'advanced' })])
    expect(r[0].agent?.command).toBe('codex')
  })
  it('si el agente elegido a mano no está libre, el rol espera: no pasa a otro', () => {
    const busy = assignRoles([role({ assign: { agent: 'a1' } })], [cand({ id: 'a1', busy: true }), cand({ id: 'a2' })])
    expect(busy[0]).toMatchObject({ status: 'queued', agent: null })
    const gone = assignRoles([role({ assign: { agent: 'a9' } })], [cand({ id: 'a2' })])
    expect(gone[0]).toMatchObject({ status: 'queued', agent: null })
    expect(gone[0].reason).toContain('a9')
    expect(assignRoles([role({ assign: { agent: 'a1' } })], [cand({ id: 'a1', quota: 99 })])[0].status).toBe('queued')
  })
  it('dos roles a mano para el mismo agente abierto: solo uno lo tiene a la vez', () => {
    const r = assignRoles([role({ id: 'a', assign: { agent: 'a1' } }), role({ id: 'b', assign: { agent: 'a1' } })], [cand({ id: 'a1' })])
    expect(r.map((x) => x.status).sort()).toEqual(['assigned', 'queued'])
  })
  it('con la elección del usuario, un rol sin agente elegido no se reparte solo; el que lo tiene sí', () => {
    const roles = [role({ id: 'libre' }), role({ id: 'elegido', assign: { agent: 'a1' } })]
    const r = assignRoles(roles, [cand({ id: 'a1' }), cand({ id: 'a2', tier: 'advanced' })], { manual: true })
    expect(r.find((x) => x.role.id === 'libre')).toMatchObject({ status: 'unassigned', agent: null })
    expect(r.find((x) => x.role.id === 'elegido')).toMatchObject({ status: 'assigned' })
    expect(r.find((x) => x.role.id === 'elegido')?.agent?.id).toBe('a1')
  })
  it('con la elección del usuario, lo que espera a otros roles sigue esperando', () => {
    const roles = [role({ id: 'db', assign: { agent: 'a1' } }), role({ id: 'api', dependsOn: ['db'] })]
    expect(assignRoles(roles, [cand({ id: 'a1' })], { manual: true }).find((x) => x.role.id === 'api')?.status).toBe('waiting')
  })
  it('un agente que acabó su rol queda libre para uno en cola', () => {
    const roles = [role({ id: 'a' }), role({ id: 'b' })]
    const busyNow = assignRoles(roles, [cand({ id: 'a1', busy: true })], { active: new Set(['a']) })
    expect(busyNow).toEqual([expect.objectContaining({ status: 'queued' })])
    const free = assignRoles(roles, [cand({ id: 'a1', busy: false })], { done: new Set(['a']) })
    expect(free[0]).toMatchObject({ status: 'assigned' })
    expect(free[0].agent?.id).toBe('a1')
  })
})

describe('revisión del plan', () => {
  const plan = { summary: 'Plan', hasRoadmap: true }
  const a = (roles: Role[], cands: RoleCandidate[]) => assignRoles(roles, cands)
  it('un plan sano no da avisos', () => {
    const roles = [role({ id: 'a' }), role({ id: 'b' })]
    expect(reviewWarnings(roles, a(roles, [cand({ id: 'a1' }), cand({ id: 'a2' })]), plan)).toEqual([])
  })
  it('avisa si no se dice qué plan es, con o sin roadmap', () => {
    const roles = [role({ id: 'a' }), role({ id: 'b' })]
    const all = a(roles, [cand({ id: 'a1' }), cand({ id: 'a2' })])
    expect(reviewWarnings(roles, all, { summary: ' ', hasRoadmap: true })[0]).toContain('roadmap')
    expect(reviewWarnings(roles, all, { summary: '', hasRoadmap: false })[0]).toContain('no tiene roadmap')
  })
  it('avisa de un solo rol y de una cadena sin paralelismo', () => {
    const one = [role({ id: 'a' })]
    expect(reviewWarnings(one, a(one, [cand({ id: 'a1' })]), plan)[0]).toContain('Solo hay un rol')
    const chain = [role({ id: 'a' }), role({ id: 'b', dependsOn: ['a'] }), role({ id: 'c', dependsOn: ['b'] })]
    expect(reviewWarnings(chain, a(chain, [cand({ id: 'a1' })]), plan)).toEqual([expect.stringContaining('en cadena')])
    const fork = [role({ id: 'a' }), role({ id: 'b', dependsOn: ['a'] }), role({ id: 'c', dependsOn: ['a'] })]
    expect(reviewWarnings(fork, a(fork, [cand({ id: 'a1' })]), plan)).toEqual([])
  })
  it('avisa de roles sin agente y de los que no llegan al nivel', () => {
    const roles = [role({ id: 'a', difficulty: 'hard' }), role({ id: 'b' })]
    const warnings = reviewWarnings(roles, a(roles, [cand({ id: 'a1', tier: 'basic' })]), plan)
    expect(warnings).toEqual([expect.stringContaining('«a» (hard)'), expect.stringContaining('«b»')])
    expect(warnings[1]).toContain('cola')
  })
})

describe('archivos fuera de los del rol', () => {
  it('lo que está dentro de sus carpetas o archivos no cuenta', () => {
    expect(outsideFiles(['src/api/', 'docs/api.md'], ['src/api/routes.ts', './docs/api.md', 'src/db/x.ts'], '/p')).toEqual(['src/db/x.ts'])
  })
  it('las rutas absolutas dentro del proyecto se comparan como relativas', () => {
    expect(outsideFiles(['src/api'], ['/p/src/api/a.ts', '/p/README.md'], '/p')).toEqual(['README.md'])
  })
  it('un rol sin archivos propios no debía tocar nada', () => {
    expect(outsideFiles([], ['a.ts', 'a.ts'], '/p')).toEqual(['a.ts'])
  })
  it('un prefijo no es una carpeta: src/api no contiene src/apiv2', () => {
    expect(outsideFiles(['src/api'], ['src/apiv2/x.ts'], '/p')).toEqual(['src/apiv2/x.ts'])
  })
})
