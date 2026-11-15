import { clsx } from 'clsx'
import { useRef } from 'react'

/** Divisor que se arrastra para cambiar el tamaño de un panel. `onDrag` recibe el desplazamiento acumulado. */
export function Resizer({ onDrag, direction = 'x' }: { onDrag: (delta: number, done: boolean) => void; direction?: 'x' | 'y' }) {
  const start = useRef<number | null>(null)
  const down = (e: React.PointerEvent): void => {
    start.current = direction === 'x' ? e.clientX : e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent): void => {
    if (start.current === null) return
    onDrag((direction === 'x' ? e.clientX : e.clientY) - start.current, false)
  }
  const up = (e: React.PointerEvent): void => {
    if (start.current === null) return
    onDrag((direction === 'x' ? e.clientX : e.clientY) - start.current, true)
    start.current = null
  }
  return (
    <div
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      className={clsx('group relative shrink-0 touch-none', direction === 'x' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize')}
    >
      <div className={clsx('absolute bg-accent/0 transition-colors group-hover:bg-accent/60 group-active:bg-accent',
        direction === 'x' ? 'inset-y-0 left-[1px] w-[2px]' : 'inset-x-0 top-[1px] h-[2px]')} />
    </div>
  )
}
