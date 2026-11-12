import { clsx } from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MdAdd, MdFitScreen, MdRefresh, MdRemove, MdRestartAlt } from 'react-icons/md'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { layoutRoles, NODE_H, NODE_W, parseRole, type PlacedNode, type RoleNode } from '../lib/roleGraph'

const REFRESH_MS = 5000
type Pos = { x: number; y: number }
const ICON_BTN = 'grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent'

const readSaved = (key: string): Record<string, Pos> => { try { return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, Pos> } catch { return {} } }

/**
 * Pestaña del editor con el grafo de los roles. Los roles se pueden arrastrar (la posición se recuerda), el fondo se desplaza y la rueda
 * hace zoom. Pulsar un rol resalta sus conexiones: de qué depende y quién lo necesita; doble clic abre su archivo.
 */
export function RoleGraphView() {
  const t = useT()
  const project = useStore((s) => s.project)
  const openDoc = useStore((s) => s.openDoc)
  const [roles, setRoles] = useState<RoleNode[]>([])
  const [hover, setHover] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const storeKey = `tutti.roles.graph.${project ?? ''}`
  const [moved, setMoved] = useState<Record<string, Pos>>(() => readSaved(storeKey))
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })          // desplazamiento y zoom del lienzo
  const box = useRef<HTMLDivElement>(null)
  const fitted = useRef(false)

  const load = useCallback(async () => {
    if (!project) return
    const dir = await window.api.context.dir(project)
    const files = (await window.api.fs.list(`${dir}/roles`).catch(() => [])).filter((f) => !f.isDir && /\.md$/i.test(f.name))
    const list = await Promise.all(files.map(async (f) => parseRole(f.name.replace(/\.md$/i, ''), await window.api.fs.read(f.path).then((d) => d.text, () => ''), f.path)))
    setRoles((prev) => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list))
  }, [project])
  useEffect(() => { void load(); const i = setInterval(() => void load(), REFRESH_MS); return () => clearInterval(i) }, [load])
  useEffect(() => { setMoved(readSaved(storeKey)) }, [storeKey])
  const save = (next: Record<string, Pos>): void => { setMoved(next); try { localStorage.setItem(storeKey, JSON.stringify(next)) } catch { /* sin almacenamiento */ } }

  const layout = useMemo(() => layoutRoles(roles), [roles])
  const pos = (n: PlacedNode): Pos => moved[n.id] ?? { x: n.x, y: n.y }
  const at = new Map(layout.nodes.map((n) => [n.id, { ...n, ...pos(n) }]))

  /** Ajusta el zoom y el desplazamiento para ver todo el grafo. */
  const fit = useCallback(() => {
    const el = box.current
    if (!el || !layout.nodes.length) return
    const all = layout.nodes.map((n) => moved[n.id] ?? { x: n.x, y: n.y })
    const minX = Math.min(...all.map((p) => p.x)) - 24, maxX = Math.max(...all.map((p) => p.x)) + NODE_W + 24
    const minY = Math.min(...all.map((p) => p.y)) - 24, maxY = Math.max(...all.map((p) => p.y)) + NODE_H + 24
    const k = Math.min(1, el.clientWidth / (maxX - minX), el.clientHeight / (maxY - minY))
    setView({ k, x: (el.clientWidth - (maxX - minX) * k) / 2 - minX * k, y: Math.max(8, (el.clientHeight - (maxY - minY) * k) / 2) - minY * k })
  }, [layout, moved])
  useEffect(() => { if (!fitted.current && layout.nodes.length) { fitted.current = true; fit() } }, [layout, fit])

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number): void => {
    const el = box.current
    if (!el) return
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2
    setView((v) => { const k = Math.min(2.5, Math.max(0.25, v.k * factor)); return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k } })
  }, [])
  // la rueda hace zoom hacia el cursor (el oyente no puede ser pasivo para impedir que se desplace la página)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const wheel = (e: WheelEvent): void => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top) }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [zoomAt, layout.nodes.length])

  // arrastrar un rol (con un umbral, para distinguirlo de un clic) o el fondo
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const down = (e: React.PointerEvent, id: string | null, from: Pos): void => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: from.x, oy: from.y, moved: false }
  }
  const move = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    if (d.id) setMoved((m) => ({ ...m, [d.id as string]: { x: d.ox + dx / view.k, y: d.oy + dy / view.k } }))
    else setView({ ...view, x: d.ox + dx, y: d.oy + dy })
  }
  const up = (): void => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.id && d.moved) save(moved)
    else if (!d.moved) setSelected((s) => (d.id ? (s === d.id ? null : d.id) : null))          // clic: elegir un rol, o quitar la elección
  }

  const focus = selected ?? hover
  const deps = focus ? at.get(focus)?.deps ?? [] : []
  const needed = focus ? layout.edges.filter((e) => e.from === focus).map((e) => e.to) : []
  const linked = (id: string): boolean => focus === null || id === focus || deps.includes(id) || needed.includes(id)
  const sel = selected ? at.get(selected) : undefined
  const chips = (ids: string[]): React.ReactNode => ids.length
    ? ids.map((id) => <button key={id} onClick={() => setSelected(id)} className="rounded-full border border-line px-2 py-0.5 text-[11px] transition-colors hover:border-accent hover:text-accent">{at.get(id)?.title ?? id}</button>)
    : <span className="text-muted">—</span>

  return (
    <div className="selectable flex min-h-0 flex-1 flex-col px-6 py-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[17px] font-semibold">{t('rg.title')}</h2>
          <p className="mt-1 text-[12px] leading-snug text-muted">{t('rg.hint')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button title={t('rg.zoomOut')} onClick={() => zoomAt(1 / 1.25)} className={ICON_BTN}><MdRemove size={16} /></button>
          <button title={t('rg.zoomIn')} onClick={() => zoomAt(1.25)} className={ICON_BTN}><MdAdd size={16} /></button>
          <button title={t('rg.fit')} onClick={fit} className={ICON_BTN}><MdFitScreen size={16} /></button>
          <button title={t('rg.resetLayout')} onClick={() => { save({}); fitted.current = false; setView({ x: 0, y: 0, k: 1 }) }} className={ICON_BTN}><MdRestartAlt size={16} /></button>
          <button title={t('rg.refresh')} onClick={() => void load()} className={ICON_BTN}><MdRefresh size={16} /></button>
        </div>
      </div>

      {layout.nodes.length === 0 ? <p className="text-[12px] text-muted">{t('rg.empty')}</p> : (
        <>
          <div ref={box} className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border border-line bg-surface">
            <svg width="100%" height="100%" role="img" aria-label={t('rg.title')} className="block select-none touch-none">
              <defs>
                {(['line', 'accent', 'ok'] as const).map((c) => (
                  <marker key={c} id={`rg-arrow-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10 z" style={{ fill: `var(--color-${c})` }} />
                  </marker>
                ))}
              </defs>
              <rect width="100%" height="100%" fill="transparent" className="cursor-grab active:cursor-grabbing" onPointerDown={(e) => down(e, null, { x: view.x, y: view.y })} onPointerMove={move} onPointerUp={up} />
              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                {layout.edges.map((e, i) => {
                  const a = at.get(e.from), b = at.get(e.to)
                  if (!a || !b) return null
                  let d: string
                  if (b.y >= a.y + NODE_H + 8) {
                    // como en un organigrama: baja del padre, recorre un pasillo horizontal encima del hijo y baja a él
                    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2
                    const lane = b.y - 18 - (e.tree ? 0 : 6 + (i % 3) * 5)
                    d = `M${x1} ${y1} V${lane} H${x2} V${b.y}`
                  } else {
                    // en la misma altura (o más arriba, si se movió): una curva entre los lados que se miran
                    const right = b.x >= a.x
                    const x1 = right ? a.x + NODE_W : a.x, x2 = right ? b.x : b.x + NODE_W, y1 = a.y + NODE_H / 2, y2 = b.y + NODE_H / 2
                    const bend = Math.max(30, Math.abs(x2 - x1) / 2) * (right ? 1 : -1)
                    d = `M${x1} ${y1} C${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
                  }
                  const kind = focus === null ? (e.tree ? 'line' : 'accent') : e.to === focus ? 'accent' : e.from === focus ? 'ok' : 'line'
                  const lead = focus !== null && (e.to === focus || e.from === focus)
                  return (
                    <path key={`${e.from}>${e.to}`} d={d} fill="none" strokeWidth={lead ? 2.2 : e.tree ? 1.5 : 1.8} strokeLinejoin="round"
                      style={{ stroke: `var(--color-${kind})`, opacity: focus === null || lead ? 1 : 0.12 }} markerEnd={`url(#rg-arrow-${kind})`} />
                  )
                })}
                {[...at.values()].map((n) => {
                  const multi = n.deps.length > 1
                  const root = n.deps.length === 0 && !n.missing
                  const fill = n.missing ? 'var(--color-panel)' : multi ? 'var(--color-accent-bg)' : root ? 'var(--color-accent)' : 'var(--color-raised)'
                  const stroke = n.id === selected ? 'var(--color-text)' : n.missing ? 'var(--color-warn)' : multi || root ? 'var(--color-accent)' : 'var(--color-line)'
                  const ink = root ? 'var(--color-bg)' : n.missing ? 'var(--color-warn)' : 'var(--color-text)'
                  const sub = root ? 'var(--color-bg)' : 'var(--color-muted)'
                  const lines = [n.agent, n.deps.length ? t('rg.needs', { n: n.deps.length }) : ''].filter(Boolean)
                  return (
                    <g key={n.id} transform={`translate(${n.x} ${n.y})`} opacity={linked(n.id) ? 1 : 0.28} className="cursor-pointer"
                      onPointerDown={(e) => down(e, n.id, { x: n.x, y: n.y })} onPointerMove={move} onPointerUp={up}
                      onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onDoubleClick={() => { if (n.file) void openDoc(n.file) }}>
                      <title>{n.missing ? `${n.id} · ${t('rg.missing')}` : [n.title, n.deps.length ? `${t('rg.needs', { n: n.deps.length })}: ${n.deps.join(', ')}` : t('rg.root'), n.agent].filter(Boolean).join('\n')}</title>
                      <rect width={NODE_W} height={NODE_H} rx={10} strokeWidth={multi || n.id === selected ? 2 : 1} strokeDasharray={n.missing ? '4 3' : undefined} style={{ fill, stroke }} />
                      <text x={NODE_W / 2} y={lines.length ? 22 : NODE_H / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={700} style={{ fill: ink }}>{n.title.length > 20 ? `${n.title.slice(0, 19)}…` : n.title}</text>
                      {lines.map((l, k) => <text key={k} x={NODE_W / 2} y={36 + k * 13} textAnchor="middle" fontSize={10} style={{ fill: sub }}>{l.length > 26 ? `${l.slice(0, 25)}…` : l}</text>)}
                      {multi && (
                        <g transform={`translate(${NODE_W - 2} 2)`}>
                          <circle r={10} style={{ fill: 'var(--color-accent)' }} />
                          <text y={4} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--color-bg)' }}>{n.deps.length}</text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>

          <div className={clsx('mt-3 min-h-[44px] rounded-lg border border-line px-3 py-2 text-[12px]', !sel && 'text-muted')}>
            {sel ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{sel.title}</span>
                  {sel.file && <button onClick={() => void openDoc(sel.file as string)} className="rounded-md px-2 py-0.5 text-[11px] text-muted transition-colors hover:text-accent">{t('rg.openFile')}</button>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 flex items-center gap-1.5 text-muted"><i className="inline-block h-0.5 w-4" style={{ background: 'var(--color-accent)' }} />{t('rg.dependsOn')}</span>{chips(sel.deps)}</div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 flex items-center gap-1.5 text-muted"><i className="inline-block h-0.5 w-4" style={{ background: 'var(--color-ok)' }} />{t('rg.neededBy')}</span>{chips(needed)}</div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-[3px]" style={{ background: 'var(--color-accent)' }} />{t('rg.root')}</span>
                <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-[3px] border" style={{ borderColor: 'var(--color-line)', background: 'var(--color-raised)' }} />{t('rg.one')}</span>
                <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-[3px] border-2" style={{ borderColor: 'var(--color-accent)', background: 'var(--color-accent-bg)' }} />{t('rg.multi')}</span>
                <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-[3px] border border-dashed" style={{ borderColor: 'var(--color-warn)' }} />{t('rg.missing')}</span>
                {layout.cycles && <span style={{ color: 'var(--color-warn)' }}>{t('rg.cycle')}</span>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
