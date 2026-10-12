import type { Lang } from '@shared/i18n'
import { slug, skillTemplate } from './spec'

/** El formulario de una skill: su nombre, cuándo usarla (la descripción, por la que el agente la elige) y, si quieres, las instrucciones. */
export interface SkillForm { name: string; description: string; instructions: string; useAgent: boolean }
export const EMPTY_SKILL_FORM: SkillForm = { name: '', description: '', instructions: '', useAgent: false }

/** Qué falta: el nombre y la descripción son imprescindibles (sin descripción el agente no sabría cuándo usarla). */
export function skillFormError(f: SkillForm): 'name' | 'description' | null {
  if (!f.name.trim()) return 'name'
  if (!f.description.trim()) return 'description'
  return null
}

/** El SKILL.md: la cabecera con el nombre y la descripción, y las instrucciones escritas o el esqueleto corto para rellenar. */
export function buildSkillFile(lang: Lang, f: SkillForm): string {
  const id = slug(f.name) || 'skill'
  const desc = f.description.trim().replace(/\s*\n+\s*/g, ' ')
  const body = f.instructions.trim()
  const skeleton = skillTemplate(lang, f.name).replace(/^---[\s\S]*?---\n/, '')
  return `---\nname: ${id}\ndescription: ${desc}\n---\n${body ? `\n# ${f.name.trim() || id}\n\n${body}\n` : skeleton}`
}

/** Lo que se le pide al agente: redactar las instrucciones de la skill que ya existe con su plantilla. */
export function skillAgentPrompt(lang: Lang, f: SkillForm, dir: string): string {
  return lang === 'en'
    ? `Write the instructions for the skill in ${dir}/SKILL.md. It already exists with a template: edit it, do not recreate it. What it does and when to use it: ${f.description.trim()}\nKeep the header (name and description) and write short, clear instructions: when to use it, the steps and any caveats. Do not invent details about the project: explore it if you need them.`
    : `Redacta las instrucciones de la skill en ${dir}/SKILL.md. Ya existe con una plantilla: edítala, no la recrees. Qué hace y cuándo usarla: ${f.description.trim()}\nConserva la cabecera (nombre y descripción) y escribe instrucciones cortas y claras: cuándo usarla, los pasos y las salvedades. No inventes datos del proyecto: explóralo si los necesitas.`
}
