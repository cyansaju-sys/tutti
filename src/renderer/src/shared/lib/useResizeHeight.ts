import { useRef, useState } from 'react'

/** Altura que el usuario arrastra con un tirador (se recuerda en localStorage); `null` = la automática. */
export function useResizeHeight(key: string, min = 64, max = 700) {
  const [height, setHeight] = useState<number | null>(() => { try { const v = Number(localStorage.getItem(key)); return v >= min ? v : null } catch { return null } })
  const body = useRef<HTMLDivElement>(null)
  const save = (h: number | null): void => { try { if (h === null) localStorage.removeItem(key); else localStorage.setItem(key, String(Math.round(h))) } catch { /* sin almacenamiento */ } }
  const start = (e: React.PointerEvent<HTMLElement>): void => {
    const startY = e.clientY
    const from = body.current?.getBoundingClientRect().height ?? min
    let last = from
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => { last = Math.min(max, Math.max(min, from + ev.clientY - startY)); setHeight(last) }
    const up = (): void => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); save(last) }
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', up)
  }
  const reset = (): void => { setHeight(null); save(null) }
  return { height, body, start, reset }
}
