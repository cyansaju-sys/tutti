import { useEffect, useRef, useState } from 'react'

const MIN = 1          // el tamaño normal es el mínimo: no se aleja más
const MAX = 20

/** Imagen centrada y ajustada a la ventana; la rueda hace zoom hacia donde está el cursor y el clic derecho la deja como estaba. */
export function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  useEffect(() => { setView({ s: 1, x: 0, y: 0 }) }, [src])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const cx = e.clientX - (r.left + r.width / 2)          // el cursor respecto al centro, que es donde se centra la imagen
      const cy = e.clientY - (r.top + r.height / 2)
      setView((v) => {
        const s = Math.min(MAX, Math.max(MIN, v.s * Math.exp(-e.deltaY * 0.0015)))
        const k = s / v.s
        // la imagen nunca se separa de su sitio: el desplazamiento no pasa de lo que ha crecido, y a 100 % vuelve al centro
        const mx = ((s - 1) * (img.current?.offsetWidth ?? 0)) / 2
        const my = ((s - 1) * (img.current?.offsetHeight ?? 0)) / 2
        return { s, x: Math.max(-mx, Math.min(mx, cx - (cx - v.x) * k)), y: Math.max(-my, Math.min(my, cy - (cy - v.y) * k)) }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })          // no pasiva: hay que impedir que la rueda desplace la página
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div ref={box} onContextMenu={(e) => { e.preventDefault(); setView({ s: 1, x: 0, y: 0 }) }} className="grid min-h-0 flex-1 cursor-zoom-in select-none place-items-center overflow-hidden p-4">
      <img ref={img} src={src} alt={alt} draggable={false} className="max-h-full max-w-full object-contain" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }} />
    </div>
  )
}
