import { clsx } from 'clsx'
import type { ReactNode } from 'react'

/** Chip pulsable de la barra de título. */
export function Chip({ icon, label, onClick, title, active }: {
  icon: ReactNode; label: string; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; title?: string; active?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx(
        'no-drag flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] transition-colors hover:bg-accent-bg',
        active ? 'text-text' : 'text-muted'
      )}
    >
      <span className="text-accent">{icon}</span>
      {label}
    </button>
  )
}
