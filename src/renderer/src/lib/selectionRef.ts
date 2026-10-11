import { agentRef } from './agentRef'

/** Hasta cuántas líneas se pegan con el código; más largo se manda solo la referencia (el agente lee el archivo). */
export const MAX_SNIPPET_LINES = 200

/** Lenguaje para la valla de código según la extensión («ts», «py»…): ayuda al agente a leer el trozo. */
const fence = (relPath: string): string => (/\.([A-Za-z0-9]+)$/.exec(relPath)?.[1] ?? '').toLowerCase()

/** «ruta:12-30» (o «ruta:12» si es una sola línea), con la @ para los agentes que la entienden. */
export function selectionRef(command: string, relPath: string, startLine: number, endLine: number): string {
  return `${agentRef(command, relPath)}:${startLine === endLine ? startLine : `${startLine}-${endLine}`}`
}

/** Lo que se escribe en el prompt del agente: la referencia y, si no es muy largo, el trozo en un bloque de código. */
export function selectionMessage(command: string, relPath: string, startLine: number, endLine: number, code: string): string {
  const ref = selectionRef(command, relPath, startLine, endLine)
  const lines = code.replace(/\s+$/, '').split('\n')
  if (!code.trim() || lines.length > MAX_SNIPPET_LINES) return `${ref} `
  return `${ref}\n\`\`\`${fence(relPath)}\n${lines.join('\n')}\n\`\`\`\n`
}
