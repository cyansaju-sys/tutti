import type { Lang } from '@shared/i18n'

/** Cuándo se entrega un steering al agente (los cuatro modos de Kiro). */
export type Inclusion = 'always' | 'fileMatch' | 'manual' | 'auto'
export const INCLUSIONS: Inclusion[] = ['always', 'fileMatch', 'manual', 'auto']
export interface SteeringForm { name: string; inclusion: Inclusion; patterns: string; description: string }
export const EMPTY_STEERING_FORM: SteeringForm = { name: '', inclusion: 'always', patterns: '', description: '' }

/** Los patrones que escribió el usuario («src/**\/*.tsx, **\/*.ts»), uno por elemento. */
export const patternList = (text: string): string[] => text.split(',').map((p) => p.trim()).filter(Boolean)

export function steeringFormError(f: SteeringForm): 'name' | 'patterns' | 'description' | null {
  if (!f.name.trim()) return 'name'
  if (f.inclusion === 'fileMatch' && patternList(f.patterns).length === 0) return 'patterns'
  if (f.inclusion === 'auto' && !f.description.trim()) return 'description'
  return null
}

/** El archivo de steering: la cabecera de Kiro con su modo, y un título para empezar a escribir. */
export function buildSteeringFile(f: SteeringForm): string {
  const name = f.name.trim().replace(/\.md$/i, '')
  const head = [`inclusion: ${f.inclusion}`]
  if (f.inclusion === 'fileMatch') {
    const list = patternList(f.patterns)
    head.push(`fileMatchPattern: ${list.length === 1 ? JSON.stringify(list[0]) : JSON.stringify(list)}`)
  }
  if (f.inclusion === 'auto') head.push(`name: ${name.replace(/\s+/g, '-').toLowerCase()}`, `description: ${f.description.trim().replace(/\n+/g, ' ')}`)
  return `---\n${head.join('\n')}\n---\n\n# ${name}\n`
}

/** Los tres archivos base de Kiro: producto, tecnología y estructura; se entregan siempre. */
export const FOUNDATION = ['product.md', 'tech.md', 'structure.md'] as const
const BASE = {
  es: {
    'product.md': '# Producto\n\n## Propósito\n\n## Usuarios\n\n## Funciones clave\n\n## Objetivos\n',
    'tech.md': '# Tecnología\n\n## Lenguajes y frameworks\n\n## Librerías y herramientas\n\n## Comandos (ejecutar, probar, compilar)\n\n## Restricciones técnicas\n',
    'structure.md': '# Estructura\n\n## Organización de archivos\n\n## Convenciones de nombres\n\n## Patrones de importación\n\n## Arquitectura\n'
  },
  en: {
    'product.md': '# Product\n\n## Purpose\n\n## Users\n\n## Key features\n\n## Goals\n',
    'tech.md': '# Technology\n\n## Languages and frameworks\n\n## Libraries and tools\n\n## Commands (run, test, build)\n\n## Technical constraints\n',
    'structure.md': '# Structure\n\n## File organization\n\n## Naming conventions\n\n## Import patterns\n\n## Architecture\n'
  }
}
export function foundationFiles(lang: Lang): Record<(typeof FOUNDATION)[number], string> {
  const b = BASE[lang === 'en' ? 'en' : 'es']
  return Object.fromEntries(FOUNDATION.map((n) => [n, `---\ninclusion: always\n---\n\n${b[n]}`])) as Record<(typeof FOUNDATION)[number], string>
}

/** Lo que se le pide al agente para rellenar los archivos base explorando el proyecto. */
export function foundationPrompt(lang: Lang, dir: string): string {
  return lang === 'en'
    ? `Explore this project and fill in product.md, tech.md and structure.md in ${dir}. They already exist with a template: edit them, do not recreate them. Base everything on what you see in the code; if something cannot be known, leave a note instead of inventing it. Be concise: they are handed to every session and cost tokens.`
    : `Explora este proyecto y rellena product.md, tech.md y structure.md en ${dir}. Ya existen con una plantilla: edítalos, no los recrees. Basa todo en lo que veas en el código; si algo no se puede saber, deja una nota en lugar de inventarlo. Sé conciso: se entregan en cada sesión y gastan tokens.`
}
