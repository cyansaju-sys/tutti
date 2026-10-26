import type { Lang } from '@shared/i18n'
import { slug } from './spec'

/** El nombre de la carpeta de un cambio: el indicado (si viene del roadmap) o las primeras palabras de lo que se pide. */
export function changeName(description: string, preferred = ''): string {
  return slug(preferred) || slug(description.trim().split(/\s+/).slice(0, 6).join(' ')).slice(0, 48).replace(/-+$/, '')
}

/** El mensaje para que el agente cree el cambio: él crea la carpeta y los archivos; sin código todavía, y validando al terminar. */
export function proposePrompt(lang: Lang, name: string, description: string): string {
  const dir = `openspec/changes/${name}`
  return lang === 'en'
    ? `Let's plan an OpenSpec change. Create it in ${dir} (create the folder and the files; if it already exists, edit what is there).\nWhat I want: ${description.trim()}\nWrite proposal.md (why, what changes, capabilities, impact), the delta specs in specs/<capability>/spec.md (## ADDED / MODIFIED / REMOVED Requirements; each "### Requirement:" with its SHALL statement and at least one "#### Scenario:" with WHEN / THEN), design.md and tasks.md (small "- [ ]" checkboxes grouped by section). Follow openspec/config.yaml. Do NOT write any application code yet. When done, run \`openspec validate ${name} --strict\` and fix what it reports.`
    : `Vamos a planificar un cambio de OpenSpec. Créalo en ${dir} (crea la carpeta y los archivos; si ya existe, edita lo que haya).\nLo que quiero: ${description.trim()}\nRedacta proposal.md (por qué, qué cambia, capacidades, impacto), los deltas de spec en specs/<capacidad>/spec.md (## ADDED / MODIFIED / REMOVED Requirements; cada «### Requirement:» con su frase DEBERÁ/SHALL y al menos un «#### Scenario:» con WHEN / THEN), design.md y tasks.md (casillas «- [ ]» pequeñas, agrupadas por sección). Sigue openspec/config.yaml. NO escribas todavía código de la aplicación. Al terminar, ejecuta \`openspec validate ${name} --strict\` y corrige lo que indique.`
}

/** El mensaje para implementar un cambio: sus tareas en orden, marcando cada casilla al terminarla. */
export function applyPrompt(lang: Lang, name: string): string {
  const dir = `openspec/changes/${name}`
  return lang === 'en'
    ? `Implement the OpenSpec change in ${dir}. Read proposal.md, the specs/ deltas, design.md and tasks.md first. Work through tasks.md in order, keep each change small and focused, and mark each task "- [x]" as soon as you finish it. If something in the plan is wrong or missing, tell me and update the files before continuing.`
    : `Implementa el cambio de OpenSpec que está en ${dir}. Lee antes proposal.md, los deltas de specs/, design.md y tasks.md. Trabaja tasks.md en orden, con cambios pequeños y centrados, y marca cada tarea con «- [x]» en cuanto la termines. Si algo del plan está mal o falta, avísame y actualiza los archivos antes de seguir.`
}
