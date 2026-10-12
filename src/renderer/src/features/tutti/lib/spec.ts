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
