import type { AgentInfo } from '@shared/types'
import type { Pane } from '@/shared/store'

/** Un agente al que se le puede pedir algo: uno que ya está abierto en un panel, o uno instalado que Tutti abrirá con la petición como tarea. */
export interface AgentOption { key: string; name: string; command: string; paneId?: string }

/** Los agentes abiertos primero (el activo el primero de todos) y, después, los instalados que aún no están abiertos. */
export function agentOptions(panes: Pane[], installed: AgentInfo[], activePane: string | null): AgentOption[] {
  const open = panes.filter((p) => p.kind === 'agent')
  const ordered = [...open.filter((p) => p.id === activePane), ...open.filter((p) => p.id !== activePane)]
  const opened = new Set(open.map((p) => p.command))
  return [
    ...ordered.map((p): AgentOption => ({ key: `pane:${p.id}`, name: p.name ?? p.title, command: p.command, paneId: p.id })),
    ...installed.filter((a) => !opened.has(a.command)).map((a): AgentOption => ({ key: `cmd:${a.command}`, name: a.name, command: a.command }))
  ]
}

/** La opción por defecto: el agente activo si hay uno abierto; si no, el primero instalado. */
export const defaultOption = (options: AgentOption[]): AgentOption | null => options[0] ?? null
