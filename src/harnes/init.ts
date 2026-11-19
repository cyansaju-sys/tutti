/** `/init` en el chat (Claude y Codex): crea el AGENTS.md del repositorio, el estándar que leen los dos (el `/init` de Claude Code por sí solo crearía un CLAUDE.md). */
export const INIT_PROMPT = 'Create an AGENTS.md file in the root of this repository: a concise contributor guide for agents and people. Cover the project structure and where things live, how to build, test and run it, coding style and naming conventions, how to write commits and pull requests, and anything non-obvious a newcomer should know. Base it on the real files and scripts of this repository, keep it short and specific, and do not invent commands that do not exist. If an AGENTS.md already exists, improve it instead of replacing it. Do not create a CLAUDE.md.'

/** El mensaje, con `/init` (y lo que se añada detrás) cambiado por su prompt; si no es `/init`, queda igual. */
export function expandInit(text: string): string {
  const m = /^\/init(?:\s+([\s\S]*))?$/.exec(text.trim())
  return m ? `${INIT_PROMPT}${m[1]?.trim() ? `\n\n${m[1].trim()}` : ''}` : text
}
