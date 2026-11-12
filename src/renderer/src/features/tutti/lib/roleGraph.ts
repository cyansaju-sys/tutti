/** El grafo de dependencias entre roles: quién depende de quién (`depends-on` de la cabecera de cada rol) y dónde dibujar cada uno. */

export interface RoleNode { id: string; title: string; agent: string; deps: string[]; file?: string }
export interface PlacedNode extends RoleNode { x: number; y: number; level: number; missing: boolean; /** cuántos roles dependen de este */ dependents: number }
/** `tree`: es la dependencia principal del rol; las otras (cuando depende de varias) se dibujan aparte, resaltadas. */
export interface Edge { from: string; to: string; tree: boolean }
export interface RoleLayout { nodes: PlacedNode[]; edges: Edge[]; width: number; height: number; cycles: boolean }

export const NODE_W = 168
export const NODE_H = 58
export const GAP_X = 36
export const GAP_Y = 56
const PAD = 24

/** Los nombres de la lista `depends-on` («a, b»): separados por coma, sin repetir ni vacíos. */
export const splitDeps = (text: string): string[] => [...new Set(text.split(',').map((d) => d.trim()).filter(Boolean))]

/** Un rol a partir de su archivo (`id` = nombre del archivo sin .md): título, agente y de quién depende. */
export function parseRole(id: string, text: string, file?: string): RoleNode {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
  const key = (k: string): string => new RegExp(`^${k}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(head)?.[1] ?? ''
  const title = /^# (.*)$/m.exec(text)?.[1]?.trim() || id
  return { id, title, agent: key('agent'), deps: splitDeps(key('depends-on')).filter((d) => d !== id), file }
}

/**
 * Coloca los roles como un organigrama: cada nivel es una fila, de arriba abajo (un rol queda debajo de todo de lo que depende) y cada rol
 * centrado bajo su dependencia principal.
 * Una dependencia que no existe como rol se dibuja como nodo «faltante». Con un ciclo no hay orden posible: se rompe y se avisa con `cycles`.
 */
export function layoutRoles(roles: RoleNode[]): RoleLayout {
  const byId = new Map(roles.map((r) => [r.id, r]))
  for (const r of roles) for (const d of r.deps) if (!byId.has(d)) byId.set(d, { id: d, title: d, agent: '', deps: [] })
  const missing = new Set([...byId.keys()].filter((id) => !roles.some((r) => r.id === id)))

  let cycles = false
  const level = new Map<string, number>()
  const visiting = new Set<string>()
  const levelOf = (id: string): number => {
    const known = level.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) { cycles = true; return 0 }
    visiting.add(id)
    const n = Math.max(-1, ...(byId.get(id)?.deps ?? []).map(levelOf)) + 1
    visiting.delete(id)
    level.set(id, n)
    return n
  }
  for (const id of byId.keys()) levelOf(id)

  // árbol por «padre principal» (la dependencia más profunda): cada rol cuelga de él; los de más dependencias llevan además sus otras flechas
  const ids = [...byId.keys()].sort((x, y) => (level.get(x) ?? 0) - (level.get(y) ?? 0) || x.localeCompare(y))
  const parent = new Map<string, string>()
  for (const id of ids) {
    const deps = (byId.get(id)?.deps ?? []).filter((d) => (level.get(d) ?? 0) < (level.get(id) ?? 0))
    const best = deps.reduce<string | undefined>((p, d) => (p === undefined || (level.get(d) ?? 0) > (level.get(p) ?? 0) ? d : p), undefined)
    if (best !== undefined) parent.set(id, best)
  }
  const children = (id: string): string[] => ids.filter((c) => parent.get(c) === id)
  // posición horizontal: las hojas en hueco consecutivo y cada padre centrado sobre sus hijos (como un organigrama)
  const slot = new Map<string, number>()
  let next = 0
  const place = (id: string): void => {
    const kids = children(id)
    if (!kids.length) { slot.set(id, next++); return }
    kids.forEach(place)
    slot.set(id, ((slot.get(kids[0]) ?? 0) + (slot.get(kids[kids.length - 1]) ?? 0)) / 2)
  }
  for (const id of ids) if (!parent.has(id)) place(id)
  for (const id of ids) if (!slot.has(id)) place(id)          // lo que quede (un ciclo)

  const edges: Edge[] = []
  for (const r of byId.values()) for (const d of r.deps) edges.push({ from: d, to: r.id, tree: parent.get(r.id) === d })
  const dependents = (id: string): number => edges.filter((e) => e.from === id).length
  const levels = Math.max(0, ...[...level.values()]) + 1
  const nodes = [...byId.values()].map((r): PlacedNode => {
    const lv = level.get(r.id) ?? 0
    return { ...r, level: lv, x: PAD + (slot.get(r.id) ?? 0) * (NODE_W + GAP_X), y: PAD + lv * (NODE_H + GAP_Y), missing: missing.has(r.id), dependents: dependents(r.id) }
  })
  return { nodes, edges, cycles, width: PAD * 2 + Math.max(0, next - 1) * (NODE_W + GAP_X) + NODE_W, height: PAD * 2 + levels * NODE_H + (levels - 1) * GAP_Y }
}
