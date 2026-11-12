import { clsx } from 'clsx'
import type { ReactNode } from 'react'

/** Botón de ícono sin borde: el estilo base de toda la barra. */
export function IconButton({ title, onClick, children, className, danger }: {
  title?: string; onClick?: () => void; children: ReactNode; className?: string; danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx(
        'no-drag grid h-[26px] w-8 place-items-center rounded-md text-muted transition-colors',
        danger ? 'hover:bg-danger/15 hover:text-danger' : 'hover:bg-accent-bg hover:text-accent',
        className
      )}
    >
      {children}
    </button>
  )
}
