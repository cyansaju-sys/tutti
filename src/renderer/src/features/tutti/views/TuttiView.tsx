import { clsx } from 'clsx'
import { useCallback, useEffect, useState } from 'react'
import { MdAdd, MdChevronRight, MdEdit, MdExplore, MdSmartToy, MdTerminal } from 'react-icons/md'
import type { MsgKey } from '@shared/i18n'
import type { DirEntry, HookInfo, SteeringInfo } from '@shared/types'
import { FIELD_SLIM } from '@/shared/components/ui'
import { McpView } from '@/features/mcp/views/McpView'
import { useAskAgent } from '@/features/tutti/lib/useAskAgent'
import { HookChoiceDialog } from '@/features/tutti/components/HookChoiceDialog'
import { DOC_CATEGORIES, OVERVIEW_FILE, overviewAgentPrompt, overviewTemplate, taskProgress, withEnabled } from '@/features/tutti/lib/spec'
import { iconFor } from '@/shared/lib/icons'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

const REFRESH_MS = 5000
/** El botón que ocupa todo el ancho donde no hay nada todavía. */
const EMPTY_BUTTON = 'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-1 text-[12px] text-muted transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent'
type Kind = 'specs' | 'hooks' | 'steering' | 'skills' | 'docs'

/** Sección plegable: el título con una flecha y, a la derecha, el botón + para añadir; se recuerda si estaba cerrada. */
/** Con más de MAX_ROWS elementos (`rows`), el contenido de la sección tiene su propio scroll: alto de MAX_ROWS filas de `rowPx`. */
const MAX_ROWS = 5
function Fold({ id, title, count, rows = 0, rowPx = 28, onAdd, addTip, children }: { id: string; title: string; count?: number; rows?: number; rowPx?: number; onAdd?: () => void; addTip?: string; children: React.ReactNode }) {
  const key = `tutti.tutti.${id}.collapsed`
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  const toggle = (): void => setCollapsed((c) => { try { localStorage.setItem(key, c ? '0' : '1') } catch { /* sin almacenamiento */ } return !c })
  return (
    <section className="border-t border-line pb-1 first:border-t-0">
      <div className="flex h-7 items-center">
        <button onClick={toggle} aria-expanded={!collapsed} className="flex h-full min-w-0 flex-1 items-center gap-1 rounded px-1 text-left text-text transition-colors hover:text-accent">
          <MdChevronRight size={14} className={clsx('shrink-0 transition-transform', !collapsed && 'rotate-90')} />
          <h4 className="truncate text-[12px] font-semibold">{title}</h4>
          {count !== undefined && <span className="ml-1 rounded-full bg-accent/25 px-2 py-px text-[10px] font-semibold text-accent">{count}</span>}
        </button>
        {onAdd && (
          <button title={addTip} onClick={() => { setCollapsed(false); try { localStorage.setItem(key, '0') } catch { /* sin almacenamiento */ } onAdd() }}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-accent-bg hover:text-accent">
            <MdAdd size={16} />
          </button>
        )}
      </div>
      {!collapsed && (rows > MAX_ROWS ? <div className="sect-scroll overflow-y-auto" style={{ maxHeight: MAX_ROWS * rowPx }}>{children}</div> : children)}
    </section>
  )
}

/** Lo que hay en la carpeta .tutti del proyecto (specs, hooks, steering, skills) y los servidores MCP instalados, cada sección con su +. */
export function TuttiView() {
  const t = useT()
  const project = useStore((s) => s.project)
  const openDoc = useStore((s) => s.openDoc)
  const toast = useStore((s) => s.toast)
  const openHookForm = useStore((s) => s.openHookForm)
  const openSpecForm = useStore((s) => s.openSpecForm)
  const openSteeringForm = useStore((s) => s.openSteeringForm)
  const openSkillForm = useStore((s) => s.openSkillForm)
  const ask = useAskAgent()
  const agent = ask.selected
  const lang = useStore((s) => s.lang)
  const [lists, setLists] = useState<Record<Kind, DirEntry[]>>({ specs: [], hooks: [], steering: [], skills: [], docs: [] })
  const [addMcp, setAddMcp] = useState(0)
  const [hookChoice, setHookChoice] = useState(false)          // el diálogo «¿cómo quieres crear el hook?»
  const [steeringInfo, setSteeringInfo] = useState<Record<string, SteeringInfo>>({})
  const [hooks, setHooks] = useState<{ list: HookInfo[]; trusted: boolean }>({ list: [], trusted: false })
  const [specInfo, setSpecs] = useState<Record<string, { files: DirEntry[]; done: number; total: number }>>({})   // por carpeta de spec
  const [openSpecs, setOpenSpecs] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState<Kind | null>(null)
  const [target, setTarget] = useState<string | null>(null)       // carpeta concreta donde crear (una categoría de la documentación)
  const [name, setName] = useState('')
  const [docCat, setDocCat] = useState<(typeof DOC_CATEGORIES)[number]>('how-to')   // categoría del documento que se está creando

  const root = project ? `${project}/.tutti` : ''                // no se crea hasta que se añade algo

  const refresh = useCallback(async () => {
    if (!project) return
    const dir = `${project}/.tutti`
    const read = (k: Kind): Promise<DirEntry[]> => window.api.fs.list(`${dir}/${k}`).catch(() => [])
    const [specs, hooks, steering, skills, docs] = await Promise.all([read('specs'), read('hooks'), read('steering'), read('skills'), read('docs')])
    const next = { specs, hooks, steering, skills, docs }
    setLists((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    const info: typeof specInfo = {}
    for (const sp of [...specs, ...docs].filter((e) => e.isDir)) {
      const files = await window.api.fs.list(sp.path).catch(() => [])
      const tasks = files.find((f) => f.name === 'tasks.md')
      const text = tasks ? await window.api.fs.read(tasks.path).then((d) => d.text, () => '') : ''
      info[sp.path] = { files, ...taskProgress(text) }
    }
    setSpecs((prev) => (JSON.stringify(prev) === JSON.stringify(info) ? prev : info))
    const st = await window.api.context.steering(project).catch(() => [] as SteeringInfo[])
    const stMap = Object.fromEntries(st.map((x) => [x.file, x]))
    setSteeringInfo((prev) => (JSON.stringify(prev) === JSON.stringify(stMap) ? prev : stMap))
    const h = await window.api.hooks.list(project).catch(() => ({ hooks: [] as HookInfo[], trusted: false }))
    setHooks((prev) => (JSON.stringify(prev) === JSON.stringify({ list: h.hooks, trusted: h.trusted }) ? prev : { list: h.hooks, trusted: h.trusted }))
  }, [project])

  useEffect(() => { void refresh(); const i = setInterval(() => void refresh(), REFRESH_MS); return () => clearInterval(i) }, [refresh])

  if (!project) return <p className="px-3 py-2 text-[12px] text-muted">{t('tutti.noProject')}</p>

  const start = (k: Kind, dir: string | null = null): void => { setCreating(k); setTarget(dir); setName('') }
  const create = async (): Promise<void> => {
    const kind = creating
    const raw = name.trim()
    const where = target
    setCreating(null); setTarget(null)
    if (!kind || !raw) return
    const sub = where ? where.slice(root.length + 1) : kind === 'docs' ? `docs/${docCat}` : kind          // carpeta de .tutti donde va lo nuevo
    const dir = await window.api.context.init(project, sub)        // la primera vez crea .tutti y esa carpeta
    const made = await window.api.fs.create(dir, /\.\w+$/.test(raw) ? raw : `${raw}.md`, false)
    if (!made.ok) { toast(made.message, 'error'); return }
    void refresh(); void openDoc(made.message)
  }
  const open = (e: DirEntry): void => {
    if (!e.isDir) { void openDoc(e.path); return }
    void window.api.fs.list(e.path).then((inside) => {
      const main = inside.find((x) => x.name.toLowerCase() === 'skill.md')
      if (main) void openDoc(main.path)
    })
  }

  const NameInput = (kind: Kind) => (
    <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void create()} spellCheck={false}
      placeholder={t(kind === 'skills' ? 'tutti.nameSkill' : 'tutti.nameFile')}
      onKeyDown={(e) => { if (e.key === 'Enter') void create(); if (e.key === 'Escape') { setName(''); setCreating(null); setTarget(null) } }}
      className={clsx(FIELD_SLIM, 'mx-1 mb-1 w-[calc(100%-0.5rem)]')} />
  )

  /** La visión general de la documentación: se crea con su esqueleto y el agente abierto la rellena explorando el proyecto. */
  const askOverview = async (): Promise<void> => {
    if (!project || !agent) return
    const dir = await window.api.context.init(project, 'docs')
    const made = await window.api.fs.create(dir, OVERVIEW_FILE, false)
    if (made.ok) await window.api.fs.write(made.message, overviewTemplate(lang), false)
    const name = await ask.send(overviewAgentPrompt(lang, '.tutti/docs'))
    if (name) toast(t('sa.sent', { agent: name }), 'ok')
    void refresh(); void openDoc(`${dir}/${OVERVIEW_FILE}`)
  }
  const toggleHook = async (h: HookInfo, index: number): Promise<void> => {
    const text = await window.api.fs.read(h.file).then((d) => d.text, () => null)
    const next = text === null ? null : withEnabled(text, index, !h.enabled)
    if (next === null) { toast(t('tutti.hookEditFail'), 'error'); return }
    await window.api.fs.write(h.file, next, false)
    void refresh()
  }
  const trust = async (on: boolean): Promise<void> => { if (project) { await window.api.hooks.trust(project, on); void refresh() } }

  /** Los hooks: cada uno con su evento y un interruptor; y la autorización del proyecto, porque ejecutan comandos del repositorio. */
  const HooksSection = () => {
    const perFile = new Map<string, number>()
    return (
      <Fold id="hooks" title={t('tutti.hooks')} count={hooks.list.length} rows={hooks.list.length} rowPx={44} onAdd={() => setHookChoice(true)} addTip={t('tutti.add.hooks')}>
        {hooks.list.length > 0 && !hooks.trusted && (
          <div className="mx-1 mb-1.5 rounded-md border border-warn/40 bg-warn/[0.08] px-2.5 py-1.5 text-[11px] leading-snug text-text">
            <span>{t('tutti.hookWarn')}</span> <button onClick={() => void trust(true)} className="mt-1 block rounded bg-accent px-2 py-0.5 font-medium text-bg hover:brightness-110">{t('tutti.hookTrust')}</button>
          </div>
        )}
        <ul>
          {hooks.list.map((h) => {
            const index = perFile.get(h.file) ?? 0
            perFile.set(h.file, index + 1)
            return (
              <li key={`${h.file}:${index}`} className="group flex h-11 items-center gap-1 rounded transition-colors hover:bg-accent-bg">
                <button onClick={() => void openDoc(h.file)} title={h.error ?? h.description ?? h.file} className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 pl-5 text-left">
                  {h.actionType === 'agent' ? <MdSmartToy size={15} className="shrink-0 text-muted" /> : <MdTerminal size={15} className="shrink-0 text-muted" />}
                  <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-[12px]">{h.name}</span>
                    {h.trigger && <span className={clsx('shrink-0 rounded px-1.5 py-px text-[9px] font-medium', h.supported ? 'bg-ov/[0.07] text-muted' : 'bg-warn/15 text-warn')} title={h.supported ? undefined : t('tutti.hookNoRun')}>{h.trigger}</span>}
                  </span>
                  <span className={clsx('truncate text-[10px]', h.error ? 'text-danger' : 'text-muted')}>{h.error ?? (h.matcher ? `${h.actionType} · ${h.matcher}` : h.actionType)}</span>
                  </span>
                </button>
                <button title={t('tutti.hookEdit')} onClick={() => openHookForm({ file: h.file, index, name: h.name })}
                  className="grid size-5 shrink-0 place-items-center rounded text-muted opacity-0 transition-all hover:text-accent group-hover:opacity-100"><MdEdit size={13} /></button>
                {!h.error && (
                  <button role="switch" aria-checked={h.enabled} title={t('tutti.hookToggle')} onClick={() => void toggleHook(h, index)}
                    className={clsx('mr-1.5 h-4 w-7 shrink-0 rounded-full p-0.5 transition-colors', h.enabled ? 'bg-accent' : 'bg-ov/[0.15]')}>
                    <span className={clsx('block size-3 rounded-full bg-white transition-transform', h.enabled && 'translate-x-3')} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {creating !== 'hooks' && hooks.list.length === 0 && (
          <div className="px-1 pt-1">
            <button onClick={() => setHookChoice(true)} className={EMPTY_BUTTON}><MdAdd size={15} /> {t('tutti.add.hooks')}</button>
          </div>
        )}
      </Fold>
    )
  }

  const Section = ({ kind, title }: { kind: Kind; title: string }) => {
    // en la documentación solo se ven las categorías que ya tienen documentos; la categoría se elige al crear uno
    const globals: DirEntry[] = kind === 'steering' ? Object.values(steeringInfo).filter((x) => x.scope === 'global').map((x) => ({ name: x.base, path: x.file, isDir: false })) : []
    const items: DirEntry[] = kind === 'docs' ? lists.docs.filter((e) => !e.isDir || specInfo[e.path]?.files.length) : lists[kind]
    const nothingYet = kind === 'docs' || items.length === 0
    return (
    <Fold id={kind} title={title} count={kind === 'docs' ? undefined : items.length} rows={items.length} onAdd={() => (kind === 'specs' ? openSpecForm() : kind === 'steering' ? openSteeringForm() : kind === 'skills' ? openSkillForm() : start(kind))} addTip={t(`tutti.add.${kind}` as MsgKey)}>
      {creating === kind && !target && NameInput(kind)}
      {creating === 'docs' && kind === 'docs' && !target && (
        <div className="mx-1 mb-1.5 flex flex-wrap gap-1" role="radiogroup" aria-label={t('tutti.category')}>
          {DOC_CATEGORIES.map((c) => (
            <button key={c} role="radio" aria-checked={docCat === c} onMouseDown={(e) => { e.preventDefault(); setDocCat(c) }}      // sin quitar el foco del campo de nombre
              className={clsx('rounded-full px-2 py-0.5 text-[10px] transition-colors', docCat === c ? 'bg-accent-bg font-medium text-accent' : 'bg-ov/[0.06] text-muted hover:text-text')}>
              {t(`tutti.cat.${c}` as MsgKey)}
            </button>
          ))}
        </div>
      )}
      <ul>{items.map((e) => (kind === 'specs' || kind === 'docs') && e.isDir ? (
        <li key={e.path}>
          <div className="group flex h-7 items-center rounded transition-colors hover:bg-accent-bg">
            <button onClick={() => setOpenSpecs((s) => { const n = new Set(s); if (!n.delete(e.path)) n.add(e.path); return n })} aria-expanded={openSpecs.has(e.path)}
              className="flex h-full min-w-0 flex-1 items-center gap-1 px-2 pl-3 text-left text-[12px]">
              <MdChevronRight size={14} className={clsx('shrink-0 text-muted transition-transform', openSpecs.has(e.path) && 'rotate-90')} />
              <span className="min-w-0 flex-1 truncate font-medium">{kind === 'docs' ? t(`tutti.cat.${e.name}` as MsgKey) : e.name}</span>
              {kind === 'specs' && specInfo[e.path]?.files.some((f) => f.name === 'bugfix.md') && <span className="shrink-0 rounded bg-danger/15 px-1.5 py-px text-[9px] font-medium text-danger">{t('tutti.bug')}</span>}
              {kind === 'specs' && specInfo[e.path]?.total ? <span className="shrink-0 rounded-full bg-ov/[0.07] px-1.5 text-[9px] font-medium text-muted" title={t('tutti.tasks')}>{specInfo[e.path].done}/{specInfo[e.path].total}</span> : null}
              {kind === 'docs' && specInfo[e.path]?.files.length ? <span className="shrink-0 rounded-full bg-ov/[0.07] px-1.5 text-[9px] font-medium text-muted">{specInfo[e.path].files.length}</span> : null}
            </button>
          </div>
          {creating === kind && target === e.path && NameInput(kind)}
          {openSpecs.has(e.path) && (specInfo[e.path]?.files ?? []).map((f) => (
            <button key={f.path} onClick={() => open(f)} className="flex h-7 w-full items-center gap-2 rounded px-2 pl-9 text-left text-[12px] transition-colors hover:bg-accent-bg">
              <img src={iconFor(f.name, f.isDir)} alt="" className="size-4 shrink-0" draggable={false} />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </li>
      ) : (
        <li key={e.path}>
          <button onClick={() => open(e)} className="flex h-7 w-full items-center gap-2 rounded px-2 pl-5 text-left text-[12px] transition-colors hover:bg-accent-bg">
            {kind === 'steering' && !e.isDir
              ? <MdExplore size={15} className="shrink-0 text-accent" aria-hidden />          // las guías de steering llevan una brújula en lugar del icono de Markdown
              : <img src={iconFor(e.name, e.isDir)} alt="" className="size-4 shrink-0" draggable={false} />}
            <span className="min-w-0 flex-1 truncate">{kind === 'steering' && !e.isDir ? e.name.replace(/\.md$/i, '') : e.name}</span>
            {kind === 'steering' && steeringInfo[e.path] && <span className="shrink-0 rounded bg-ov/[0.07] px-1.5 py-px text-[9px] font-medium text-muted" title={steeringInfo[e.path].patterns.join(', ') || steeringInfo[e.path].description || undefined}>{steeringInfo[e.path].scope === 'global' ? `${t('stf.global')} · ` : ''}{t(`stf.m.${steeringInfo[e.path].inclusion}` as MsgKey)}</span>}
          </button>
        </li>
      ))}</ul>
      {creating !== kind && nothingYet && (
        <div className="px-1 pt-1">
          {kind === 'docs' && !lists.docs.some((e) => e.name === OVERVIEW_FILE) && (
            <button onClick={() => void askOverview()} disabled={!agent} title={agent ? t('tutti.overviewTip') : t('sa.noAgent')} className={clsx(EMPTY_BUTTON, 'mb-1 disabled:cursor-not-allowed disabled:opacity-40')}>{t('tutti.overviewAgent')}</button>
          )}
          <button onClick={() => (kind === 'specs' ? openSpecForm() : kind === 'steering' ? openSteeringForm() : kind === 'skills' ? openSkillForm() : start(kind))} className={EMPTY_BUTTON}><MdAdd size={15} /> {t(`tutti.add.${kind}` as MsgKey)}</button>
        </div>
      )}
    </Fold>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-2 pb-2">
      <Section kind="docs" title={t('tutti.docs')} />
      <Section kind="specs" title={t('tutti.specs')} />
      {HooksSection()}
      {hookChoice && <HookChoiceDialog onClose={() => setHookChoice(false)} />}
      <Section kind="steering" title={t('tutti.steering')} />
      <Section kind="skills" title={t('tutti.skills')} />
      <Fold id="mcp" title={t('tutti.mcp')} onAdd={() => setAddMcp((n) => n + 1)} addTip={t('mcp.addTip')}>
        <McpView compact part="installed" addSignal={addMcp} />
      </Fold>
    </div>
  )
}
