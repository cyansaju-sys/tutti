import type { useStore } from '@/store'

type State = ReturnType<typeof useStore.getState>

/** La vista de agentes: «Modo agentes» sin agentes de terminal abiertos. Abrir un archivo o partir el chat no la quitan: el editor sale a la derecha del chat, y la segunda conversación al lado de la primera. */
export const isHubLayout = (s: State): boolean => s.editorFull && s.chatOpen && !!s.project && s.panes.length === 0

