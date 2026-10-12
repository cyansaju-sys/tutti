import { clsx } from 'clsx'
import { useCallback, useEffect, useState } from 'react'
import { MdAdd, MdChevronRight } from 'react-icons/md'
import type { MsgKey } from '@shared/i18n'
import type { DirEntry } from '@shared/types'
import { FIELD_SLIM } from '@/shared/components/ui'
import { McpView } from '@/features/mcp/views/McpView'
import { DOC_CATEGORIES, slug, specTemplates, SPEC_FILES, taskProgress } from '@/features/tutti/lib/spec'
import { iconFor } from '@/shared/lib/icons'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

const REFRESH_MS = 5000
/** El botón que ocupa todo el ancho donde no hay nada todavía. */
const EMPTY_BUTTON = 'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-[12px] text-muted transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent'
type Kind = 'specs' | 'hooks' | 'steering' | 'skills' | 'docs'
/** Un archivo de steering nuevo: `inclusion: manual` no gasta tokens; cámbialo a `always` para que Tutti lo entregue a cada agente. */
const STEERING_TEMPLATE = (name: string): string => `---\ninclusion: manual\n---\n\n# ${name}\n`
const SKILL_TEMPLATE = (name: string): string => `---\nname: ${name}\ndescription: \n---\n\n# ${name}\n`

/** Sección plegable: el título con una flecha; se recuerda si estaba cerrada. */
function Fold({ id, title, count, children }: { id: string; title: string; count?: number; children: React.ReactNode }) {
  const key = `tutti.tutti.${id}.collapsed`
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  const toggle = (): void => setCollapsed((c) => { try { localStorage.setItem(key, c ? '0' : '1') } catch { /* sin almacenamiento */ } return !c })
  return (
    <section className="mb-2">
      <div className="flex items-center">
        <button onClick={toggle} aria-expanded={!collapsed} className="flex min-w-0 flex-1 items-center gap-0.5 rounded px-1 py-1 text-left text-muted/80 transition-colors hover:text-text">
          <MdChevronRight size={14} className={clsx('shrink-0 transition-transform', !collapsed && 'rotate-90')} />
          <h4 className="truncate text-[10px] font-semibold uppercase tracking-wider">{title}</h4>
          {count !== undefined && <span className="ml-1 rounded-full bg-ov/[0.07] px-1.5 text-[9px] font-medium">{count}</span>}
        </button>
      </div>
      {!collapsed && children}
    </section>
  )
}

/** Lo que hay en la carpeta .tutti del proyecto (specs, hooks, steering, skills) y los servidores MCP instalados, cada sección con su +. */
export function TuttiView() {
  const t = useT()
  const project = useStore((s) => s.project)
  const openDoc = useStore((s) => s.openDoc)
  const toast = useStore((s) => s.toast)
  const lang = useStore((s) => s.lang)
  const [lists, setLists] = useState<Record<Kind, DirEntry[]>>({ specs: [], hooks: [], steering: [], skills: [], docs: [] })
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
    if (kind === 'specs') {                                       // una spec es una carpeta con requisitos, diseño y tareas
      const folder = slug(raw)
      if (!folder) return
      const made = await window.api.fs.create(dir, folder, true)
      if (!made.ok) { toast(made.message, 'error'); return }
      const docs = specTemplates(lang, raw)
      for (const f of SPEC_FILES) await window.api.fs.write(`${made.message}/${f}`, docs[f], false)
      setOpenSpecs((s) => new Set(s).add(made.message))
      void refresh(); void openDoc(`${made.message}/requirements.md`)
      return
    }
    if (kind === 'skills') {                                      // una skill es una carpeta con su SKILL.md
      const made = await window.api.fs.create(dir, raw, true)
      if (!made.ok) { toast(made.message, 'error'); return }
      const file = `${made.message}/SKILL.md`
      await window.api.fs.write(file, SKILL_TEMPLATE(raw), false)
      void refresh(); void openDoc(file)
      return
    }
    const made = await window.api.fs.create(dir, /\.\w+$/.test(raw) ? raw : `${raw}.md`, false)
    if (!made.ok) { toast(made.message, 'error'); return }
    if (kind === 'steering') await window.api.fs.write(made.message, STEERING_TEMPLATE(raw.replace(/\.md$/i, '')), false)
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

  const Section = ({ kind, title }: { kind: Kind; title: string }) => {
    // en la documentación solo se ven las categorías que ya tienen documentos; la categoría se elige al crear uno
    const items: DirEntry[] = kind === 'docs' ? lists.docs.filter((e) => !e.isDir || specInfo[e.path]?.files.length) : lists[kind]
    const nothingYet = kind === 'docs' || items.length === 0
    return (
    <Fold id={kind} title={title} count={kind === 'docs' ? undefined : items.length}>
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
          <div className="group flex items-center rounded transition-colors hover:bg-accent-bg">
            <button onClick={() => setOpenSpecs((s) => { const n = new Set(s); if (!n.delete(e.path)) n.add(e.path); return n })} aria-expanded={openSpecs.has(e.path)}
              className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1 pl-3 text-left text-[12px]">
              <MdChevronRight size={14} className={clsx('shrink-0 text-muted transition-transform', openSpecs.has(e.path) && 'rotate-90')} />
              <span className="min-w-0 flex-1 truncate font-medium">{kind === 'docs' ? t(`tutti.cat.${e.name}` as MsgKey) : e.name}</span>
              {kind === 'specs' && specInfo[e.path]?.total ? <span className="shrink-0 rounded-full bg-ov/[0.07] px-1.5 text-[9px] font-medium text-muted" title={t('tutti.tasks')}>{specInfo[e.path].done}/{specInfo[e.path].total}</span> : null}
              {kind === 'docs' && specInfo[e.path]?.files.length ? <span className="shrink-0 rounded-full bg-ov/[0.07] px-1.5 text-[9px] font-medium text-muted">{specInfo[e.path].files.length}</span> : null}
            </button>
          </div>
          {creating === kind && target === e.path && NameInput(kind)}
          {openSpecs.has(e.path) && (specInfo[e.path]?.files ?? []).map((f) => (
            <button key={f.path} onClick={() => open(f)} className="flex w-full items-center gap-2 rounded px-2 py-1 pl-9 text-left text-[12px] transition-colors hover:bg-accent-bg">
              <img src={iconFor(f.name, f.isDir)} alt="" className="size-4 shrink-0" draggable={false} />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </li>
      ) : (
        <li key={e.path}>
          <button onClick={() => open(e)} className="flex w-full items-center gap-2 rounded px-2 py-1 pl-5 text-left text-[12px] transition-colors hover:bg-accent-bg">
            <img src={iconFor(e.name, e.isDir)} alt="" className="size-4 shrink-0" draggable={false} />
            <span className="truncate">{e.name}</span>
          </button>
        </li>
      ))}</ul>
      {creating !== kind && nothingYet && (
        <div className="px-1 pt-1">
          <button onClick={() => start(kind)} className={EMPTY_BUTTON}><MdAdd size={15} /> {t(`tutti.add.${kind}` as MsgKey)}</button>
        </div>
      )}
    </Fold>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-2 pb-2">
      <Section kind="docs" title={t('tutti.docs')} />
      <Section kind="specs" title={t('tutti.specs')} />
      <Section kind="hooks" title={t('tutti.hooks')} />
      <Section kind="steering" title={t('tutti.steering')} />
      <Section kind="skills" title={t('tutti.skills')} />
      <Fold id="mcp" title={t('tutti.mcp')}>
        <McpView compact part="installed" />
      </Fold>
    </div>
  )
}
