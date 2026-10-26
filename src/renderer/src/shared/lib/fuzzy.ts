/** Cómo de bien encaja `query` con una ruta: cuanto más bajo, mejor; null si no encaja. Primero el nombre, luego la ruta y por último las letras sueltas en orden. */
export function fuzzyScore(query: string, path: string): number | null {
  const q = query.toLowerCase()
  if (!q) return 0
  const p = path.toLowerCase().replace(/\/$/, '')
  const name = p.split('/').pop() ?? p
  if (name.startsWith(q)) return 0
  const inName = name.indexOf(q)
  if (inName >= 0) return 1 + inName / 100
  const inPath = p.indexOf(q)
  if (inPath >= 0) return 2 + inPath / 1000
  let at = 0, gaps = 0, last = -1
  for (const ch of q) {                          // letras sueltas, en orden
    const next = p.indexOf(ch, at)
    if (next < 0) return null
    if (last >= 0 && next !== last + 1) gaps++
    last = next; at = next + 1
  }
  return 3 + gaps / 100
}
