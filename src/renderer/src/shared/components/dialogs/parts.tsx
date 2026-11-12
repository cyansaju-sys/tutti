import { clsx } from 'clsx'
import type { ReactNode } from 'react'

/** Ícono dentro de una pastilla cuadrada: da el mismo ritmo a todas las filas. */
export const Chip = ({ active, children }: { active: boolean; children: ReactNode }) => (
  <span className={clsx('grid size-7 shrink-0 place-items-center rounded-md transition-colors', active ? 'bg-accent/15 text-accent' : 'bg-ov/[0.04] text-muted')}>{children}</span>
)
export const Tag = ({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' }) => (
  <span className={clsx('ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', tone === 'accent' ? 'bg-accent/15 text-accent' : 'bg-ov/[0.05] text-muted')}>{children}</span>
)
