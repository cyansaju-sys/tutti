import type { Lang } from '@shared/i18n'

/** Categorías de la documentación (Diátaxis): tutoriales, guías prácticas, referencia y explicación. Se muestran siempre; su carpeta se crea al añadir el primer documento. */
export const DOC_CATEGORIES = ['tutorials', 'how-to', 'reference', 'explanation'] as const

/** «nueva función de login» → «nueva-funcion-de-login»: nombre de carpeta seguro. */
export const slug = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Tareas hechas / totales de un tasks.md (casillas «- [x]» y «- [ ]», también anidadas). */
export function taskProgress(text: string): { done: number; total: number } {
  let done = 0, total = 0
  for (const m of text.matchAll(/^\s*[-*] \[( |x|X)\]/gm)) { total++; if (m[1] !== ' ') done++ }
  return { done, total }
}

/** Los eventos de un hook (como en Kiro) y cuáles ejecuta Tutti. */
export const HOOK_TRIGGERS = [
  { id: 'PostFileSave', runs: true }, { id: 'PreToolUse', runs: false }, { id: 'PostToolUse', runs: false }, { id: 'Stop', runs: false }
] as const

export interface HookForm { name: string; description: string; trigger: string; matcher: string; action: 'command' | 'agent'; command: string; prompt: string; timeout: string }
export const EMPTY_HOOK_FORM: HookForm = { name: '', description: '', trigger: 'PostFileSave', matcher: '', action: 'agent', command: '', prompt: '', timeout: '60' }

/** Qué falta o está mal en el formulario de un hook (clave de texto), o null si se puede crear. */
export function hookFormError(f: HookForm): 'name' | 'command' | 'prompt' | 'matcher' | 'timeout' | null {
  if (!f.name.trim()) return 'name'
  if (f.action === 'command' && !f.command.trim()) return 'command'
  if (f.action === 'agent' && !f.prompt.trim()) return 'prompt'
  if (f.matcher.trim()) { try { new RegExp(f.matcher) } catch { return 'matcher' } }
  if (f.action === 'command' && (!/^\d+$/.test(f.timeout.trim()) || Number(f.timeout) > 3600)) return 'timeout'
  return null
}

/** El archivo JSON de un hook, en el formato de Kiro: solo lleva los campos que se rellenaron. */
export function buildHookFile(f: HookForm): string {
  const timeout = Number(f.timeout)
  const hook = {
    name: f.name.trim(), ...(f.description.trim() && { description: f.description.trim() }), trigger: f.trigger, ...(f.matcher.trim() && { matcher: f.matcher.trim() }),
    action: f.action === 'command' ? { type: 'command', command: f.command.trim() } : { type: 'agent', prompt: f.prompt.trim() },
    ...(f.action === 'command' && timeout !== 60 && { timeout }), enabled: true
  }
  return JSON.stringify({ version: 'v1', hooks: [hook] }, null, 2) + '\n'
}

/** Cambia `enabled` del hook número `index` de un archivo de hooks; devuelve el JSON nuevo, o null si no se puede leer. */
export function withEnabled(text: string, index: number, enabled: boolean): string | null {
  try {
    const data = JSON.parse(text) as { hooks?: Array<Record<string, unknown>> }
    if (!data.hooks?.[index]) return null
    data.hooks[index].enabled = enabled
    return JSON.stringify(data, null, 2) + '\n'
  } catch { return null }
}

/** Una skill nueva: cabecera con su nombre (en minúsculas y con guiones) y una descripción de cuándo usarla, y un esqueleto corto para rellenar. */
export function skillTemplate(lang: Lang, name: string): string {
  const id = slug(name) || 'skill'
  return lang === 'en'
    ? `---\nname: ${id}\ndescription: What it does and when to use it (the agent picks the skill from this description).\n---\n\n# ${name.trim() || id}\n\n## When to use it\n\n- \n\n## Steps\n\n1. \n2. \n\n## Notes\n\n- \n`
    : `---\nname: ${id}\ndescription: Qué hace y cuándo usarla (el agente elige la skill por esta descripción).\n---\n\n# ${name.trim() || id}\n\n## Cuándo usarla\n\n- \n\n## Pasos\n\n1. \n2. \n\n## Notas\n\n- \n`
}

/** La visión general de la documentación (lo general del proyecto): se crea con un esqueleto que el agente puede rellenar. */
export const OVERVIEW_FILE = 'overview.md'
export function overviewTemplate(lang: Lang): string {
  return lang === 'en'
    ? '# Overview\n\n## What it is\n\n## Who it is for\n\n## Technologies\n\n## How to run and test it\n'
    : '# Visión general\n\n## Qué es\n\n## Para quién\n\n## Tecnologías\n\n## Cómo se ejecuta y se prueba\n'
}
export function overviewAgentPrompt(lang: Lang, dir: string): string {
  return lang === 'en'
    ? `Explore this project and fill in ${dir}/overview.md: what it is, who it is for, the technologies and how to run and test it. It already exists with a template: edit it, do not recreate it. Base it on what you see in the code and keep it short; if something cannot be known, leave a note instead of inventing it.`
    : `Explora este proyecto y rellena ${dir}/overview.md: qué es, para quién, las tecnologías y cómo se ejecuta y se prueba. Ya existe con una plantilla: edítalo, no lo recrees. Básate en lo que veas en el código y sé breve; si algo no se puede saber, deja una nota en lugar de inventarlo.`
}
