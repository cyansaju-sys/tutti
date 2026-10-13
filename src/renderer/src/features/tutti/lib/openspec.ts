import type { Lang } from '@shared/i18n'
import { slug } from './spec'

/** El formulario de un cambio nuevo de OpenSpec: su nombre (la carpeta), qué se quiere y quién redacta los archivos. */
export interface ChangeForm { name: string; description: string; useAgent: boolean }
export const EMPTY_CHANGE_FORM: ChangeForm = { name: '', description: '', useAgent: false }

/** Qué falta en el formulario, o null si se puede crear. Para que el agente redacte hace falta saber qué se quiere. */
export function changeFormError(f: ChangeForm): 'name' | 'description' | null {
  if (!slug(f.name)) return 'name'
  if (f.useAgent && !f.description.trim()) return 'description'
  return null
}

const T = {
  es: {
    proposal: (d: string) => `## Por qué\n\n${d || 'El problema o la oportunidad.'}\n\n## Qué cambia\n\n- \n\n## Capacidades\n\n### Nuevas\n\n- \`nombre-de-la-capacidad\`: qué hace\n\n### Modificadas\n\n## Impacto\n\n`,
    spec: '## ADDED Requirements\n\n### Requirement: Nombre del requisito\nEl sistema DEBERÁ hacer algo concreto.\n\n#### Scenario: Caso principal\n- **WHEN** ocurre algo\n- **THEN** el sistema responde así\n',
    design: '## Contexto\n\n## Objetivos / No objetivos\n\n## Decisiones\n\n## Riesgos y compromisos\n',
    tasks: '## 1. Primera parte\n\n- [ ] 1.1 Primera tarea\n- [ ] 1.2 Segunda tarea\n\n## 2. Segunda parte\n\n- [ ] 2.1 Tercera tarea\n'
  },
  en: {
    proposal: (d: string) => `## Why\n\n${d || 'The problem or the opportunity.'}\n\n## What Changes\n\n- \n\n## Capabilities\n\n### New Capabilities\n\n- \`capability-name\`: what it does\n\n### Modified Capabilities\n\n## Impact\n\n`,
    spec: '## ADDED Requirements\n\n### Requirement: Requirement name\nThe system SHALL do something specific.\n\n#### Scenario: Main case\n- **WHEN** something happens\n- **THEN** the system responds like this\n',
    design: '## Context\n\n## Goals / Non-Goals\n\n## Decisions\n\n## Risks / Trade-offs\n',
    tasks: '## 1. First part\n\n- [ ] 1.1 First task\n- [ ] 1.2 Second task\n\n## 2. Second part\n\n- [ ] 2.1 Third task\n'
  }
}

/** Los archivos de un cambio (rutas dentro de su carpeta) con su plantilla: la propuesta, un delta de spec, el diseño y las tareas. */
export function changeFiles(lang: Lang, f: ChangeForm): Record<string, string> {
  const t = T[lang === 'en' ? 'en' : 'es']
  return { 'proposal.md': t.proposal(f.description.trim()), [`specs/${slug(f.name)}/spec.md`]: t.spec, 'design.md': t.design, 'tasks.md': t.tasks }
}

/** El mensaje para que el agente redacte el cambio: los archivos ya existen con una plantilla; sin código todavía, y validando al terminar. */
export function proposePrompt(lang: Lang, name: string, description: string): string {
  const dir = `openspec/changes/${name}`
  return lang === 'en'
    ? `Let's plan an OpenSpec change in ${dir}. The files already exist with a template: edit them, do not recreate them.\nWhat I want: ${description.trim()}\nFill in proposal.md (why, what changes, capabilities, impact), the delta specs in specs/<capability>/spec.md (## ADDED / MODIFIED / REMOVED Requirements; each "### Requirement:" with its SHALL statement and at least one "#### Scenario:" with WHEN / THEN), design.md and tasks.md (small "- [ ]" checkboxes grouped by section). Follow openspec/config.yaml. Do NOT write any application code yet. When done, run \`openspec validate ${name} --strict\` and fix what it reports.`
    : `Vamos a planificar un cambio de OpenSpec en ${dir}. Los archivos ya existen con una plantilla: edítalos, no los recrees.\nLo que quiero: ${description.trim()}\nRellena proposal.md (por qué, qué cambia, capacidades, impacto), los deltas de spec en specs/<capacidad>/spec.md (## ADDED / MODIFIED / REMOVED Requirements; cada «### Requirement:» con su frase DEBERÁ/SHALL y al menos un «#### Scenario:» con WHEN / THEN), design.md y tasks.md (casillas «- [ ]» pequeñas, agrupadas por sección). Sigue openspec/config.yaml. NO escribas todavía código de la aplicación. Al terminar, ejecuta \`openspec validate ${name} --strict\` y corrige lo que indique.`
}

/** El mensaje para implementar un cambio: sus tareas en orden, marcando cada casilla al terminarla. */
export function applyPrompt(lang: Lang, name: string): string {
  const dir = `openspec/changes/${name}`
  return lang === 'en'
    ? `Implement the OpenSpec change in ${dir}. Read proposal.md, the specs/ deltas, design.md and tasks.md first. Work through tasks.md in order, keep each change small and focused, and mark each task "- [x]" as soon as you finish it. If something in the plan is wrong or missing, tell me and update the files before continuing.`
    : `Implementa el cambio de OpenSpec que está en ${dir}. Lee antes proposal.md, los deltas de specs/, design.md y tasks.md. Trabaja tasks.md en orden, con cambios pequeños y centrados, y marca cada tarea con «- [x]» en cuanto la termines. Si algo del plan está mal o falta, avísame y actualiza los archivos antes de seguir.`
}
