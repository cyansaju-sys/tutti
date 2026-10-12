import type { Lang } from '@shared/i18n'

/** Los archivos de una spec: requisitos (Kiro), diseño y tareas. Cada spec es una carpeta en .tutti/specs/. */
export const SPEC_FILES = ['requirements.md', 'design.md', 'tasks.md'] as const

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

const T = {
  es: {
    requirements: (n: string) => `# Requisitos: ${n}\n\n## Introducción\n\nQué se quiere conseguir y para quién.\n\n## Requisitos\n\n### 1. Primer requisito\n\n**Historia de usuario:** Como <rol>, quiero <función>, para <beneficio>.\n\n**Criterios de aceptación (EARS):**\n\n1. CUANDO <evento o condición> EL SISTEMA DEBERÁ <comportamiento esperado>.\n2. MIENTRAS <estado> EL SISTEMA DEBERÁ <comportamiento esperado>.\n`,
    design: (n: string) => `# Diseño: ${n}\n\n## Visión general\n\n## Arquitectura\n\n## Componentes e interfaces\n\n## Modelo de datos\n\n## Manejo de errores\n\n## Estrategia de pruebas\n`,
    tasks: (n: string) => `# Tareas: ${n}\n\n- [ ] 1. Primera tarea\n  - [ ] 1.1 Subtarea\n  - _Requisitos: 1_\n- [ ] 2. Segunda tarea\n`
  },
  en: {
    requirements: (n: string) => `# Requirements: ${n}\n\n## Introduction\n\nWhat we want to achieve and for whom.\n\n## Requirements\n\n### 1. First requirement\n\n**User story:** As a <role>, I want <feature>, so that <benefit>.\n\n**Acceptance criteria (EARS):**\n\n1. WHEN <event or condition> THE SYSTEM SHALL <expected behavior>.\n2. WHILE <state> THE SYSTEM SHALL <expected behavior>.\n`,
    design: (n: string) => `# Design: ${n}\n\n## Overview\n\n## Architecture\n\n## Components and interfaces\n\n## Data model\n\n## Error handling\n\n## Testing strategy\n`,
    tasks: (n: string) => `# Tasks: ${n}\n\n- [ ] 1. First task\n  - [ ] 1.1 Subtask\n  - _Requirements: 1_\n- [ ] 2. Second task\n`
  }
}

export const specTemplates = (lang: Lang, name: string): Record<(typeof SPEC_FILES)[number], string> => {
  const t = T[lang === 'en' ? 'en' : 'es']
  return { 'requirements.md': t.requirements(name), 'design.md': t.design(name), 'tasks.md': t.tasks(name) }
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
