import type { useStore } from '@/store'

type State = ReturnType<typeof useStore.getState>

/** La vista de agentes: «Modo agentes» con el chat solo (sin archivos ni agentes de terminal abiertos) y sin partir. */
export const isHubLayout = (s: State): boolean => s.editorFull && s.chatOpen && !!s.project && s.docs.length === 0 && s.panes.length === 0 && !s.chatSplit

