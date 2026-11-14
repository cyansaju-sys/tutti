import type { Lang } from '@/shared/i18n'
import { slug } from './spec'

/** El nombre de la carpeta de una spec: el indicado (si viene del roadmap) o las primeras palabras de lo que se pide. */
export function specName(description: string, preferred = ''): string {
  return slug(preferred) || slug(description.trim().split(/\s+/).slice(0, 6).join(' ')).slice(0, 48).replace(/-+$/, '')
}

/** El mensaje para que el agente cree la spec: él crea la carpeta y los tres archivos; sin código todavía. `dir` es la carpeta de specs (p. ej. `.tutti/specs`). */
export function planPrompt(lang: Lang, dir: string, name: string, description: string): string {
  const folder = `${dir}/${name}`
  return lang === 'en'
    ? `Let's plan a spec. Create it in ${folder} (create the folder and the files; if it already exists, edit what is there).\nWhat I want: ${description.trim()}\nWrite requirements.md (an introduction and numbered requirements; each one as a user story "As a <role>, I want <goal>, so that <benefit>" with acceptance criteria in the form "WHEN <event> THEN the system SHALL <behavior>"), design.md (overview, architecture and components, data models, error handling and testing strategy) and tasks.md (small "- [ ]" checkboxes grouped by section, each one pointing to the requirements it covers). Follow the steering files of the project. Do NOT write any application code yet.`
    : `Vamos a planificar una spec. Créala en ${folder} (crea la carpeta y los archivos; si ya existe, edita lo que haya).\nLo que quiero: ${description.trim()}\nRedacta requirements.md (una introducción y requisitos numerados; cada uno como historia de usuario «Como <rol>, quiero <objetivo>, para <beneficio>» con criterios de aceptación en la forma «CUANDO <evento> ENTONCES el sistema DEBERÁ <comportamiento>»), design.md (visión general, arquitectura y componentes, modelos de datos, manejo de errores y estrategia de pruebas) y tasks.md (casillas «- [ ]» pequeñas, agrupadas por sección, cada una indicando los requisitos que cubre). Sigue los steering del proyecto. NO escribas todavía código de la aplicación.`
}

/** El mensaje para implementar una spec: sus tareas en orden, marcando cada casilla al terminarla. */
export function applyPrompt(lang: Lang, dir: string, name: string): string {
  const folder = `${dir}/${name}`
  return lang === 'en'
    ? `Implement the spec in ${folder}. Read requirements.md, design.md and tasks.md first. Work through tasks.md in order, keep each change small and focused, and mark each task "- [x]" as soon as you finish it. If something in the plan is wrong or missing, tell me and update the files before continuing.`
    : `Implementa la spec que está en ${folder}. Lee antes requirements.md, design.md y tasks.md. Trabaja tasks.md en orden, con cambios pequeños y centrados, y marca cada tarea con «- [x]» en cuanto la termines. Si algo del plan está mal o falta, avísame y actualiza los archivos antes de seguir.`
}
