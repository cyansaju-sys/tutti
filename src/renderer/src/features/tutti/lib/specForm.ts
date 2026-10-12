import type { Lang } from '@shared/i18n'
import { specTemplates } from './spec'

/** El formulario de una spec nueva, como el flujo guiado de Kiro: ¿funcionalidad o error?, ¿qué quieres?, ¿empezar por requisitos o por diseño? */
export type SpecType = 'feature' | 'bugfix'
export type SpecFlow = 'requirements-first' | 'design-first' | 'quick'
export interface SpecForm { name: string; type: SpecType; flow: SpecFlow; description: string; useAgent: boolean }
export const EMPTY_SPEC_FORM: SpecForm = { name: '', type: 'feature', flow: 'requirements-first', description: '', useAgent: false }

/** Qué falta en el formulario, o null si se puede crear. Para que el agente redacte hace falta saber qué se quiere. */
export function specFormError(f: SpecForm): 'name' | 'description' | null {
  if (!f.name.trim()) return 'name'
  if (f.useAgent && !f.description.trim()) return 'description'
  return null
}

const BUG = {
  es: {
    bugfix: (n: string, d: string) => `# Análisis del error: ${n}\n\n## Descripción\n\n${d || 'Qué falla, cómo se reproduce y qué se esperaba.'}\n\n## Comportamiento actual (defecto)\n\n1. CUANDO <condición> ENTONCES el sistema <comportamiento incorrecto>.\n\n## Comportamiento esperado (correcto)\n\n1. CUANDO <condición> ENTONCES el sistema DEBERÁ <comportamiento correcto>.\n\n## Comportamiento que no debe cambiar (prevención de regresiones)\n\n1. CUANDO <condición> ENTONCES el sistema DEBERÁ SEGUIR <comportamiento existente>.\n`,
    design: (n: string) => `# Diseño de la corrección: ${n}\n\n## Causa raíz\n\n## Enfoque de la corrección\n\n## Propiedades a comprobar\n\n- El código actual produce el comportamiento incorrecto (el error existe).\n- El código corregido produce el comportamiento correcto.\n- El comportamiento que no debe cambiar sigue funcionando.\n`,
    tasks: (n: string) => `# Tareas: ${n}\n\n- [ ] 1. Escribir una prueba que reproduzca el error\n- [ ] 2. Corregir la causa raíz\n- [ ] 3. Comprobar que el error está corregido\n- [ ] 4. Comprobar que no hay regresiones\n`
  },
  en: {
    bugfix: (n: string, d: string) => `# Bug analysis: ${n}\n\n## Description\n\n${d || 'What fails, how to reproduce it and what was expected.'}\n\n## Current behavior (defect)\n\n1. WHEN <condition> THEN the system <incorrect behavior>.\n\n## Expected behavior (correct)\n\n1. WHEN <condition> THEN the system SHALL <correct behavior>.\n\n## Unchanged behavior (regression prevention)\n\n1. WHEN <condition> THEN the system SHALL CONTINUE TO <existing behavior>.\n`,
    design: (n: string) => `# Fix design: ${n}\n\n## Root cause\n\n## Fix approach\n\n## Properties to check\n\n- The current code produces the incorrect behavior (the bug exists).\n- The fixed code produces the correct behavior.\n- The behavior that must not change still works.\n`,
    tasks: (n: string) => `# Tasks: ${n}\n\n- [ ] 1. Write a test that reproduces the bug\n- [ ] 2. Fix the root cause\n- [ ] 3. Check the bug is fixed\n- [ ] 4. Check there are no regressions\n`
  }
}

/** Los archivos de la spec con su plantilla (la descripción va en la introducción del primero): `bugfix.md` en lugar de `requirements.md` si es un error. */
export function specFiles(lang: Lang, f: SpecForm): Record<string, string> {
  const name = f.name.trim(), d = f.description.trim()
  if (f.type === 'bugfix') {
    const t = BUG[lang === 'en' ? 'en' : 'es']
    return { 'bugfix.md': t.bugfix(name, d), 'design.md': t.design(name), 'tasks.md': t.tasks(name) }
  }
  const base = specTemplates(lang, name)
  if (!d) return { ...base }
  const intro = lang === 'en' ? 'What we want to achieve and for whom.' : 'Qué se quiere conseguir y para quién.'
  const overview = lang === 'en' ? '## Overview\n' : '## Visión general\n'
  return f.flow === 'design-first'
    ? { ...base, 'design.md': base['design.md'].replace(overview, `${overview}\n${d}\n`) }
    : { ...base, 'requirements.md': base['requirements.md'].replace(intro, d) }
}

/** El archivo que se abre primero: donde empieza el flujo elegido. */
export const firstSpecFile = (f: SpecForm): string => (f.type === 'bugfix' ? 'bugfix.md' : f.flow === 'design-first' ? 'design.md' : 'requirements.md')

/** El orden de las fases (como en Kiro): requisitos o análisis → diseño → tareas; con «diseño primero», el diseño va antes. */
export function specPhases(f: SpecForm): string[] {
  if (f.type === 'bugfix') return ['bugfix.md', 'design.md', 'tasks.md']
  return f.flow === 'design-first' ? ['design.md', 'requirements.md', 'tasks.md'] : ['requirements.md', 'design.md', 'tasks.md']      // «rápida» sigue el orden de requisitos primero
}

const PHASE = {
  es: {
    'requirements.md': 'historias de usuario con criterios de aceptación en formato EARS (CUANDO … EL SISTEMA DEBERÁ …), casos límite y errores',
    'bugfix.md': 'el análisis del error: comportamiento actual (defecto), esperado y el que no debe cambiar (CUANDO … ENTONCES …)',
    'design.md-feature': 'arquitectura, componentes e interfaces, modelo de datos, manejo de errores y estrategia de pruebas',
    'design.md-bugfix': 'causa raíz (explorando el código), enfoque de la corrección y propiedades a comprobar',
    'tasks.md': 'una lista de tareas con casillas «- [ ]» (subtareas anidadas si hace falta), cada una pequeña y con sus requisitos'
  },
  en: {
    'requirements.md': 'user stories with acceptance criteria in EARS format (WHEN … THE SYSTEM SHALL …), edge cases and errors',
    'bugfix.md': 'the bug analysis: current (defective), expected and unchanged behavior (WHEN … THEN …)',
    'design.md-feature': 'architecture, components and interfaces, data model, error handling and testing strategy',
    'design.md-bugfix': 'root cause (exploring the code), fix approach and properties to check',
    'tasks.md': 'a task list with “- [ ]” checkboxes (nested subtasks if needed), each one small and linked to its requirements'
  }
}

/** El mensaje que se le escribe al agente: trabajar la spec por fases, esperando la aprobación entre una y otra, sin escribir código todavía. */
export function specAgentPrompt(lang: Lang, f: SpecForm, dir: string): string {
  const en = lang === 'en'
  const p = PHASE[en ? 'en' : 'es']
  const phases = specPhases(f).map((file, i) => `${i + 1}. ${file}: ${p[(file === 'design.md' ? `design.md-${f.type === 'bugfix' ? 'bugfix' : 'feature'}` : file) as keyof typeof p]}.`)
  const kind = en ? (f.type === 'bugfix' ? 'bug fix' : `feature, ${f.flow}`) : (f.type === 'bugfix' ? 'corrección de un error' : `funcionalidad, ${f.flow === 'design-first' ? 'diseño primero' : f.flow === 'quick' ? 'rápida' : 'requisitos primero'}`)
  if (f.flow === 'quick' && f.type === 'feature') {          // Quick Spec: los tres archivos de una vez, sin pasos de aprobación
    const files = specPhases(f).join(', ')
    return en
      ? `Let's write a quick spec (${kind}) in ${dir}. The files already exist with a template: edit them, do not recreate them.\nWhat I want: ${f.description.trim()}\nFill in ${files} in one pass, without waiting for my approval between files: ${phases.map((p) => p.replace(/^\d+\. /, '')).join(' ')}\nDo not write code yet.`
      : `Vamos a redactar una spec rápida (${kind}) en ${dir}. Los archivos ya existen con una plantilla: edítalos, no los recrees.\nLo que quiero: ${f.description.trim()}\nRellena ${files} de una sola vez, sin esperar mi aprobación entre archivos: ${phases.map((p) => p.replace(/^\d+\. /, '')).join(' ')}\nNo escribas código todavía.`
  }
  return en
    ? `Let's write a spec (${kind}) in ${dir}. The files already exist with a template: edit them, do not recreate them.\nWhat I want: ${f.description.trim()}\nWork in phases and wait for my approval before moving to the next one:\n${phases.join('\n')}\nDo not write code yet.`
    : `Vamos a redactar una spec (${kind}) en ${dir}. Los archivos ya existen con una plantilla: edítalos, no los recrees.\nLo que quiero: ${f.description.trim()}\nTrabaja por fases y espera mi aprobación antes de pasar a la siguiente:\n${phases.join('\n')}\nNo escribas código todavía.`
}
