import { clsx } from 'clsx'
import type { ReactNode } from 'react'

/** Chip pulsable de la barra de título. */
export function Chip({ icon, label, onClick, title, active, open }: {
  icon?: ReactNode; label: string; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; title?: string; active?: boolean; open?: boolean          // open: el efecto de hover se queda mientras su menú está abierto
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx(
        'no-drag flex items-center gap-1.5 rounded-[4px] px-2 py-[3px] text-[12px] font-light transition-colors hover:bg-accent-bg',
        active ? 'text-text' : 'text-muted',
        open && 'bg-accent-bg'
      )}
    >
      {icon && <span className="text-accent">{icon}</span>}
      {label}
    </button>
  )
}
