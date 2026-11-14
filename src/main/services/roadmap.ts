/**
 * El roadmap del proyecto: el plan por fases, un nivel por encima de las specs. Es Markdown normal:
 *   ## Fase 1 — Datos         cada «##» es una fase
 *   - [x] `init-db` — …       cada elemento de lista (de primer nivel) es un ítem; el `nombre` del principio lo vincula a una spec
 *   - Pagos con Stripe        sin casilla ni nombre también vale (su estado solo lo sabe quien mire el código)
 * El estado de cada ítem sale de su casilla y de `specs/` (en marcha, con el avance de sus tareas; terminada si están todas hechas).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { RoadmapItem, RoadmapPhase, RoadmapState } from '@/shared/types'
import { tuttiDirName } from './context/context'
import { specsDir, taskCounts } from './specs'

/** Dónde se busca, en orden: el de `.tutti` y, si no, el que ya tenga el proyecto en la raíz. */
const candidates = (project: string): string[] => [`${tuttiDirName(project)}/roadmap.md`, 'ROADMAP.md', 'roadmap.md']
export const roadmapFile = (project: string): string =>
  candidates(project).map((c) => join(project, c)).find((f) => existsSync(f)) ?? join(project, candidates(project)[0])

const SAFE = /^[\w.-]+$/
const ITEM = /^ ?(?:[-*+]|\d+[.)])\s+(.*)$/          // solo los de primer nivel: las sublistas son detalle del ítem
const BOX = /^\[( |x|X)\]\s+/

/** Lo que dice el texto, sin estado: fases con sus ítems, su casilla (null si no tiene) y el cambio que nombran al principio. */
export function parseRoadmap(text: string): Array<{ title: string; line: number; items: Array<{ text: string; checked: boolean | null; change: string | null; mentions: string[]; line: number }> }> {
  const phases: ReturnType<typeof parseRoadmap> = []
  let fence = false
  text.split(/\r?\n/).forEach((raw, i) => {
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; return }
    if (fence) return
    const head = /^##\s+(.+?)\s*#*\s*$/.exec(raw)
    if (head) { phases.push({ title: head[1], line: i + 1, items: [] }); return }
    const item = ITEM.exec(raw)
    const phase = phases[phases.length - 1]
    if (!item || !phase) return
    let body = item[1]
    const box = BOX.exec(body)
    if (box) body = body.slice(box[0].length)
    const lead = /^`([^`]+)`\s*(?:[—–:-]\s*)?/.exec(body)
    const change = lead && SAFE.test(lead[1]) ? lead[1] : null
    if (change) body = body.slice(lead![0].length)
    const mentions = [...body.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((m) => SAFE.test(m))
    phase.items.push({ text: body.trim() || (change ?? ''), checked: box ? box[1] !== ' ' : null, change, mentions, line: i + 1 })
  })
  return phases
}

const dirs = (path: string): string[] => {
  try { return readdirSync(path, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) } catch { return [] }
}
const read = (path: string): string => { try { return readFileSync(path, 'utf8') } catch { return '' } }

export function roadmapState(project: string): RoadmapState {
  const file = roadmapFile(project)
  const exists = existsSync(file)
  const root = specsDir(project)
  const active = new Set(dirs(root))

  const phases: RoadmapPhase[] = parseRoadmap(exists ? read(file) : '').map((p) => ({
    title: p.title, line: p.line,
    items: p.items.map((it): RoadmapItem => {
      // el nombre del principio manda; si no hay, cualquier `nombre` del texto que sea una spec de verdad
      const change = it.change ?? it.mentions.find((m) => active.has(m)) ?? null
      const base = { text: it.text, change, line: it.line, dir: null, done: 0, total: 0 }
      if (change && active.has(change)) {
        const dir = join(root, change)
        const counts = taskCounts(read(join(dir, 'tasks.md')))
        return { ...base, dir, ...counts, status: it.checked || (counts.total > 0 && counts.done === counts.total) ? 'done' : 'active' }
      }
      if (it.checked) return { ...base, status: 'done' }
      return { ...base, status: it.checked === false || change ? 'pending' : 'unknown' }
    })
  }))

  // la fase actual es la primera con algo sin terminar; lo siguiente, lo que esté en marcha y, si no hay, lo primero que falte de esa fase
  const current = phases.findIndex((p) => p.items.some((it) => it.status !== 'done'))
  let next: RoadmapState['next'] = null
  for (let pi = Math.max(current, 0); current >= 0 && pi < phases.length && !next; pi++) {
    const ii = phases[pi].items.findIndex((it) => it.status === 'active')
    if (ii >= 0) next = { phase: pi, item: ii }
  }
  if (current >= 0 && !next) next = { phase: current, item: phases[current].items.findIndex((it) => it.status !== 'done') }
  return { file, rel: relative(project, file).split('\\').join('/'), exists, phases, current, next }
}
