import type { ReactNode } from 'react'

/** Inserta un elemento donde el texto tiene el marcador \u0001 (para frases con una parte resaltada). */
export const Rich = ({ text, node }: { text: string; node: ReactNode }) => {
  const [before, after = ''] = text.split('\u0001')
  return <>{before}{node}{after}</>
}

/** Coincidencia difusa: «clk» encuentra «Claude». */
export const matches = (text: string, query: string): boolean => {
  const t = text.toLowerCase()
  let pos = 0
  for (const ch of query.toLowerCase()) { pos = t.indexOf(ch, pos) + 1; if (pos === 0) return false }
  return true
}
