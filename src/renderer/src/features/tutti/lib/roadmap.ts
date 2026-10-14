import type { Lang } from '@shared/i18n'
import type { RoadmapItem, RoadmapState } from '@shared/types'

/** Hechos y total de una fase (lo que no se sabe cuenta como no hecho). */
export const phaseProgress = (items: RoadmapItem[]): { done: number; total: number } =>
  ({ done: items.filter((i) => i.status === 'done').length, total: items.length })

/** Un roadmap nuevo: la forma que entiende Tutti (fases con «##» y un `cambio` por ítem), para rellenar. */
export function roadmapTemplate(lang: Lang): string {
  return lang === 'en'
    ? '# Roadmap\n\nOne "##" per phase; each item is a spec. Start it with its `change-name` (the folder in openspec/changes) to link it.\n\n## Phase 1 — Foundations\n\n- [ ] `first-change` — what it delivers\n- [ ] `second-change` — what it delivers\n\n## Phase 2 — \n\n- [ ] \n'
    : '# Roadmap\n\nUna fase por «##»; cada ítem es una spec. Empiézalo con su `nombre-del-cambio` (la carpeta en openspec/changes) para vincularlo.\n\n## Fase 1 — Base\n\n- [ ] `primer-cambio` — qué entrega\n- [ ] `segundo-cambio` — qué entrega\n\n## Fase 2 — \n\n- [ ] \n'
}

/** El mensaje para que el agente redacte el roadmap: ya existe con la plantilla; fases pequeñas, una spec por ítem, sin escribir código. */
export function draftRoadmapPrompt(lang: Lang, rel: string): string {
  return lang === 'en'
    ? `Explore this project (code, README, .tutti/docs, openspec/ and \`git log --oneline -30\`) and write its roadmap in ${rel}. It already exists with a template: edit it, do not recreate it. One "## Phase N — Name" per phase, in the order they should be built, and under each a list of specs: "- [ ] \`change-name\` — what it delivers", where change-name is kebab-case and will be the folder in openspec/changes. Mark "- [x]" what is already done in the code. Keep specs small (a few days each). If you are missing information about the goals, ask me before inventing phases. Do NOT write application code.`
    : `Explora este proyecto (código, README, .tutti/docs, openspec/ y \`git log --oneline -30\`) y escribe su roadmap en ${rel}. Ya existe con una plantilla: edítalo, no lo recrees. Una «## Fase N — Nombre» por fase, en el orden en que deben construirse, y debajo la lista de specs: «- [ ] \`nombre-del-cambio\` — qué entrega», con el nombre en kebab-case (será la carpeta en openspec/changes). Marca con «- [x]» lo que ya esté hecho en el código. Specs pequeñas (unos días cada una). Si te falta información sobre los objetivos, pregúntame antes de inventar fases. NO escribas código de la aplicación.`
}

const LABEL = {
  es: { done: 'hecho', active: 'en marcha', pending: 'sin spec', unknown: 'sin verificar' },
  en: { done: 'done', active: 'in progress', pending: 'no spec yet', unknown: 'unverified' }
}

/** Lo que Tutti ya sabe del roadmap, en texto: cada fase con su avance y lo que no está hecho, marcando la actual y lo siguiente. */
export function roadmapSummary(lang: Lang, state: RoadmapState): string {
  const l = LABEL[lang === 'en' ? 'en' : 'es']
  return state.phases.map((p, pi) => {
    const { done, total } = phaseProgress(p.items)
    const head = `${pi === state.current ? '▶ ' : ''}${p.title} (${done}/${total})`
    const items = pi < state.current ? [] : p.items.filter((it) => it.status !== 'done').map((it) => {
      const ii = p.items.indexOf(it)
      const next = state.next?.phase === pi && state.next.item === ii ? (lang === 'en' ? ' ← next' : ' ← siguiente') : ''
      const tasks = it.status === 'active' && it.total ? ` ${it.done}/${it.total}` : ''
      const name = [it.change && `\`${it.change}\``, it.text !== it.change && it.text].filter(Boolean).join(' ')
      return `  - ${name} [${l[it.status]}${tasks}]${next}`
    })
    return [head, ...items].join('\n')
  }).join('\n')
}

/**
 * El mensaje para retomar el proyecto: con el resumen que ya calculó Tutti, el agente verifica en el código y en git dónde nos quedamos (sin
 * fiarse solo de las casillas), propone los siguientes pasos y espera aprobación antes de programar.
 */
export function resumePrompt(lang: Lang, state: RoadmapState): string {
  const summary = roadmapSummary(lang, state)
  return lang === 'en'
    ? `I'm coming back to this project: tell me where we left off and what comes next. The plan is in ${state.rel}. Tutti's summary (from the checkboxes and openspec/):\n${summary}\n\nDo this:\n1. Read ${state.rel}, the tasks.md of the changes in progress in openspec/changes/, and run \`git log --oneline -20\` and \`git status\`.\n2. Check in the code what is really done: do not trust the checkboxes alone, and resolve the items marked "unverified".\n3. Answer with two sections: "Where we left off (verified)" (per phase, briefly) and "Next steps" (the concrete next spec or task, and what it needs).\n4. If ${state.rel} does not match reality, propose the fix.\nDo NOT write code or change files yet: wait for my approval.`
    : `Vuelvo a este proyecto: dime dónde nos quedamos y qué sigue. El plan está en ${state.rel}. El resumen de Tutti (según las casillas y openspec/):\n${summary}\n\nHaz esto:\n1. Lee ${state.rel}, los tasks.md de los cambios en marcha de openspec/changes/, y ejecuta \`git log --oneline -20\` y \`git status\`.\n2. Comprueba en el código qué está hecho de verdad: no te fíes solo de las casillas, y resuelve los ítems «sin verificar».\n3. Responde con dos apartados: «Dónde nos quedamos (verificado)» (por fase, breve) y «Siguientes pasos» (la siguiente spec o tarea concreta y lo que necesita).\n4. Si ${state.rel} no cuadra con la realidad, propón la corrección.\nNO escribas código ni cambies archivos todavía: espera mi aprobación.`
}
