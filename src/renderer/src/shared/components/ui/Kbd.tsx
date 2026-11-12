import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line px-2 py-0.5 font-mono text-[10px] text-accent">{children}</kbd>
}
