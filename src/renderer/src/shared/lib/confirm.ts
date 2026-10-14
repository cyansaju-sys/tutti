import { create } from 'zustand'

/**
 * Preguntas de sí o no dentro de la app, en lugar de `window.confirm`. El diálogo nativo deja el foco de Chromium a medias en Linux:
 * después, la terminal pierde el parpadeo del cursor y no recibe el Espacio ni lo que escribe el teclado con composición.
 */
interface Ask { message: string; ok: string | null; resolve: (yes: boolean) => void }
export const useConfirm = create<{ ask: Ask | null }>(() => ({ ask: null }))

/** Pregunta y espera la respuesta (`true` si acepta). Una pregunta anterior sin contestar se da por cancelada. */
export function confirmAsk(message: string, ok?: string): Promise<boolean> {
  useConfirm.getState().ask?.resolve(false)
  const before = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  return new Promise((resolve) => {
    const ask: Ask = {
      message, ok: ok ?? null,
      resolve: (yes) => {
        if (useConfirm.getState().ask === ask) useConfirm.setState({ ask: null })
        resolve(yes)
        // el foco vuelve a donde estaba (la terminal, el editor), salvo que quien preguntó ya lo haya movido o ese elemento ya no exista
        setTimeout(() => { if (before?.isConnected && (!document.activeElement || document.activeElement === document.body)) before.focus() }, 0)
      }
    }
    useConfirm.setState({ ask })
  })
}
