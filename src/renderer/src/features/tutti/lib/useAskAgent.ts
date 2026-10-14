import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/shared/store'
import { agentOptions, defaultOption, type AgentOption } from './agentTarget'

/**
 * Pedirle algo a un agente desde la pestaña Tutti: elige uno abierto o instalado (por defecto, el activo). Si el elegido está abierto, se le
 * escribe la petición y se envía; si no, Tutti lo abre con la petición como tarea inicial.
 */
export function useAskAgent() {
  const panes = useStore((s) => s.panes)
  const activePane = useStore((s) => s.activePane)
  const installed = useStore((s) => s.agents)
  const set = useStore((s) => s.set)
  const openAgent = useStore((s) => s.openAgent)
  const toast = useStore((s) => s.toast)
  const [picked, setPicked] = useState<string | null>(null)
  // los agentes instalados se leen una vez si aún no se habían leído (lo hace también la pestaña Agentes)
  useEffect(() => { if (!installed.length) void window.api.agents.detect().then((a) => set({ agents: a })) }, [installed.length, set])
  const options = useMemo(() => agentOptions(panes, installed, activePane), [panes, installed, activePane])
  const selected: AgentOption | null = options.find((o) => o.key === picked) ?? defaultOption(options)

  /** Envía la petición al agente elegido; devuelve el nombre del agente, o null si no hay ninguno. */
  const send = async (prompt: string, agent: AgentOption | null = selected): Promise<string | null> => {
    if (!agent) return null
    if (agent.paneId) {
      window.api.pty.paste(agent.paneId, prompt)
      setTimeout(() => window.api.pty.write(agent.paneId!, '\r'), 500)
      useStore.getState().focusPane(agent.paneId)          // el teclado pasa al agente: puedes seguir escribiéndole
    } else await openAgent({ name: agent.name, command: agent.command }, [], { prompt })
    return agent.name
  }
  return { options, selected, setPicked, send, toast }
}
