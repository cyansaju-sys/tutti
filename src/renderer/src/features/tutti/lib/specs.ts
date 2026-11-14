import type { Lang } from '@/shared/i18n'
import { slug } from './spec'

/** El nombre de la carpeta de una spec: el indicado (si viene del roadmap) o las primeras palabras de lo que se pide. */
export function specName(description: string, preferred = ''): string {
  return slug(preferred) || slug(description.trim().split(/\s+/).slice(0, 6).join(' ')).slice(0, 48).replace(/-+$/, '')
}

/** El mensaje para que el agente cree la spec: él crea la carpeta y los tres archivos (su estructura ya la tiene el chat). `dir` es la carpeta de specs (p. ej. `.tutti/specs`). */
export function planPrompt(lang: Lang, dir: string, name: string, description: string): string {
  const folder = `${dir}/${name}`
  return lang === 'en'
    ? `Let's plan a spec. Create it in ${folder} (create the folder and the requirements.md, design.md and tasks.md files; if it already exists, edit what is there).\nWhat I want: ${description.trim()}\nFollow the steering files of the project.`
    : `Vamos a planificar una spec. Créala en ${folder} (crea la carpeta y los archivos requirements.md, design.md y tasks.md; si ya existe, edita lo que haya).\nLo que quiero: ${description.trim()}\nSigue los steering del proyecto.`
}

/** El mensaje para implementar una spec: sus tareas en orden, marcando cada casilla al terminarla. */
export function applyPrompt(lang: Lang, dir: string, name: string): string {
  const folder = `${dir}/${name}`
  return lang === 'en'
    ? `Implement the spec in ${folder}. Read requirements.md, design.md and tasks.md first. Work through tasks.md in order, keep each change small and focused, and mark each task "- [x]" as soon as you finish it. If something in the plan is wrong or missing, tell me and update the files before continuing.`
    : `Implementa la spec que está en ${folder}. Lee antes requirements.md, design.md y tasks.md. Trabaja tasks.md en orden, con cambios pequeños y centrados, y marca cada tarea con «- [x]» en cuanto la termines. Si algo del plan está mal o falta, avísame y actualiza los archivos antes de seguir.`
}
