import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseRoadmap, roadmapFile, roadmapState } from '@/main/services/roadmap'

let project = ''
beforeEach(() => { project = mkdtempSync(join(tmpdir(), 'tutti-rm-')) })
afterEach(() => rmSync(project, { recursive: true, force: true }))
const put = (rel: string, text = ''): void => { const f = join(project, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, text) }

const ROADMAP = `# Roadmap

Intro que no es de ninguna fase.
- tampoco esto

## Fase 1 — Datos
- [x] \`init-db\` — migración y RLS
- [ ] \`shortlinks\` — tabla y redirección
  - detalle que no es un ítem
- Pagos con \`stripe\`

## Fase 2 — Panel ###
1. [ ] \`admin-panel\`: el panel

\`\`\`md
## No es una fase
- [ ] ni esto
\`\`\`
`

describe('roadmap', () => {
  it('lee fases, ítems de primer nivel, casillas y el cambio del principio', () => {
    const phases = parseRoadmap(ROADMAP)
    expect(phases.map((p) => p.title)).toEqual(['Fase 1 — Datos', 'Fase 2 — Panel'])
    expect(phases[0].items).toEqual([
      expect.objectContaining({ text: 'migración y RLS', checked: true, change: 'init-db', line: 7 }),
      expect.objectContaining({ text: 'tabla y redirección', checked: false, change: 'shortlinks' }),
      expect.objectContaining({ text: 'Pagos con `stripe`', checked: null, change: null, mentions: ['stripe'] })
    ])
    expect(phases[1].items).toEqual([expect.objectContaining({ text: 'el panel', checked: false, change: 'admin-panel' })])
  })

  it('usa .tutti/roadmap.md y, si no hay, el ROADMAP.md de la raíz', () => {
    expect(roadmapFile(project)).toBe(join(project, '.tutti/roadmap.md'))
    expect(roadmapState(project)).toMatchObject({ exists: false, phases: [], current: -1, next: null, rel: '.tutti/roadmap.md' })
    put('ROADMAP.md', '## A\n')
    expect(roadmapFile(project)).toBe(join(project, 'ROADMAP.md'))
    put('.tutti/roadmap.md', '## B\n')
    expect(roadmapFile(project)).toBe(join(project, '.tutti/roadmap.md'))
  })

  it('cruza los ítems con las specs de .tutti/specs', () => {
    put('.tutti/roadmap.md', ROADMAP)
    put('.tutti/specs/shortlinks/tasks.md', '- [x] 1.1 a\n- [ ] 1.2 b\n')
    put('.tutti/specs/stripe/tasks.md', '- [x] 1.1 a\n')
    const s = roadmapState(project)
    expect(s.phases[0].items.map((i) => i.status)).toEqual(['done', 'active', 'done'])
    expect(s.phases[0].items[1]).toMatchObject({ done: 1, total: 2, dir: join(project, '.tutti/specs/shortlinks') })
    expect(s.phases[0].items[2]).toMatchObject({ change: 'stripe', dir: join(project, '.tutti/specs/stripe') })
    expect(s.phases[1].items[0].status).toBe('pending')
    expect(s).toMatchObject({ current: 0, next: { phase: 0, item: 1 } })
  })

  it('sin nada en marcha, lo siguiente es lo primero que falta de la fase actual', () => {
    put('ROADMAP.md', '## Hecha\n- [x] a\n\n## Actual\n- algo sin casilla\n- [ ] `b`\n\n## Después\n- [ ] c\n')
    const s = roadmapState(project)
    expect(s.phases[1].items.map((i) => i.status)).toEqual(['unknown', 'pending'])
    expect(s).toMatchObject({ current: 1, next: { phase: 1, item: 0 } })
  })

  it('con todo hecho no hay fase actual ni siguiente', () => {
    put('ROADMAP.md', '## A\n- [x] a\n- [X] b\n')
    expect(roadmapState(project)).toMatchObject({ current: -1, next: null })
  })
})
