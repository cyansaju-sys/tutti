import { useEffect, type RefObject } from 'react'

/**
 * Navegación con el teclado de una lista flotante: flecha arriba/abajo recorre los botones con `data-row`, Enter o Tab pulsan el resaltado
 * (solo si se ha navegado; si no, siguen siendo del input) y flecha izquierda llama a `onBack`. Se reinicia al cambiar `reset`.
 */
export function useListNav(box: RefObject<HTMLElement | null>, reset: unknown, onBack?: () => void): void {
  useEffect(() => {
    let index = -1
    const rows = (): HTMLElement[] => [...(box.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])]
    const mark = (list: HTMLElement[]): void => {
      list.forEach((el, i) => { if (i === index) el.setAttribute('data-active', 'true'); else el.removeAttribute('data-active') })
      list[index]?.scrollIntoView({ block: 'nearest' })
    }
    const key = (e: KeyboardEvent): void => {
      const list = rows()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!list.length) return
        e.preventDefault(); e.stopPropagation()
        index = e.key === 'ArrowDown' ? (index + 1) % list.length : index <= 0 ? list.length - 1 : index - 1
        mark(list)
      } else if ((e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) && index >= 0 && list[index]) {          // Tab autocompleta lo resaltado, igual que Enter
        e.preventDefault(); e.stopPropagation()
        list[index].click()
      } else if (e.key === 'ArrowLeft' && onBack && index >= 0) {
        e.preventDefault(); e.stopPropagation()
        onBack()
      } else if (e.key === 'ArrowRight' && index >= 0 && list[index]?.hasAttribute('data-enter')) {
        e.preventDefault(); e.stopPropagation()
        list[index].click()
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [box, reset, onBack])
}
