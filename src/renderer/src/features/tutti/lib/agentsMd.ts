import type { Lang } from '@shared/i18n'

/** Lo que ya hay en `.tutti/` y que el AGENTS.md debe referenciar en vez de copiar. */
export interface TuttiContents { steering: string[]; skills: string[]; docs: boolean; specs: boolean }

/**
 * La petición al agente para rellenar el AGENTS.md recién creado: lo propio del proyecto va encima del bloque de Tutti, y lo que ya está
 * en `.tutti/` se referencia por su ruta, sin duplicarlo.
 */
export function agentsMdPrompt(lang: Lang, have: TuttiContents): string {
  const found = [
    have.steering.length ? `.tutti/steering/ (${have.steering.join(', ')})` : '',
    have.docs ? '.tutti/docs/' : '',
    have.specs ? 'openspec/' : '',
    have.skills.length ? `.tutti/skills/ (${have.skills.join(', ')})` : ''
  ].filter(Boolean).join(', ')
  return lang === 'en'
    ? `Fill in the AGENTS.md of this project. It already exists with a block between <!-- tutti:start --> and <!-- tutti:end -->: do not edit or move it; write everything else ABOVE it. `
      + `Keep it short and concrete, only what an agent needs and cannot guess: what the project is, the exact commands to install, run, build and test (read them from package.json, a Makefile, etc.), the folder structure that matters, code conventions, and what not to do. `
      + (found ? `What already lives in ${found} must NOT be copied: read it first and, where it applies, just point to it by path (for example «see .tutti/steering/tech.md»). ` : '')
      + `Base it on what you see in the code and use at most ~60 lines; if something cannot be known, leave it out instead of inventing it.`
    : `Rellena el AGENTS.md de este proyecto. Ya existe con un bloque entre <!-- tutti:start --> y <!-- tutti:end -->: no lo edites ni lo muevas; escribe todo lo demás ENCIMA de él. `
      + `Sé breve y concreto, solo lo que un agente necesita y no puede adivinar: qué es el proyecto, los comandos exactos para instalar, ejecutar, construir y probar (léelos de package.json, un Makefile, etc.), la estructura de carpetas que importa, las convenciones de código y lo que no debe hacer. `
      + (found ? `Lo que ya está en ${found} NO lo copies: léelo antes y, donde aplique, solo remite a ello por su ruta (por ejemplo «ver .tutti/steering/tech.md»). ` : '')
      + `Básate en lo que veas en el código y usa como mucho unas 60 líneas; si algo no se puede saber, déjalo fuera en lugar de inventarlo.`
}
