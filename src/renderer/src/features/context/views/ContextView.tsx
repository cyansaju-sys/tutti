import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { MdAutoAwesome, MdChevronRight, MdEdit, MdSave, MdVisibility } from 'react-icons/md'
import type { ContextSource } from '@shared/types'
import type { MsgKey } from '@shared/i18n'
import { Markdown } from '@/features/files/components/Markdown'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

const SAVE_MS = 600
const BIG_TOKENS = 3000        // a partir de aquí se avisa: cada agente lo lee entero al empezar
const tokensOf = (chars: number): number => Math.ceil(chars / 4)
type Scope = 'project' | 'global'
/** Las plantillas sin tocar: si es lo que hay, se abre directamente en modo edición. */
const IS_TEMPLATE = /Lo que escribas aquí lo leen|What you write here is read by|las leen todos los agentes|read by every agent/

/**
 * Contexto para los agentes, en dos capas: el del proyecto (AGENTS.md si el proyecto ya lo tiene, y si no .tutti/steering/contexto.md) y el global (tus preferencias en todos los
 * proyectos). Se ve como Markdown y se edita al pulsar «Editar» o con doble clic.
 */
export function ContextView() {
  const t = useT()
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const [scope, setScope] = useState<Scope>('project')
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [file, setFile] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [writing, setWriting] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [sources, setSources] = useState<ContextSource[]>([])
  const [showSources, setShowSources] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const pending = useRef<{ file: string; value: string } | null>(null)
  const active: Scope = project ? scope : 'global'          // sin proyecto abierto solo hay contexto global

  // guarda lo pendiente (al cambiar de proyecto, de capa o de pestaña no se pierde lo último que se escribió)
  const flush = (): Promise<void> => {
    clearTimeout(timer.current)
    const p = pending.current
    pending.current = null
    if (!p) return Promise.resolve()
    const prepare = active === 'project' && project && p.file.includes('.tutti') ? window.api.context.init(project, 'steering') : Promise.resolve('')      // en .tutti, la primera vez crea la carpeta
    return prepare.then(() => window.api.fs.write(p.file, p.value, false)).then(() => undefined)
  }

  useEffect(() => {
    setFile(null); setText(''); setState('idle')
    let live = true
    const load = active === 'global'
      ? window.api.context.ensureGlobal().then(async (path) => ({ file: path, text: (await window.api.fs.read(path)).text }))
      : window.api.context.open(project!).then((c) => ({ file: c.file, text: c.text }))
    void load.then((c) => { if (live) { setFile(c.file); setText(c.text); setMode(!c.text.trim() || IS_TEMPLATE.test(c.text) ? 'edit' : 'view') } })
    return () => { live = false; void flush() }
  }, [project, active])  // eslint-disable-line react-hooks/exhaustive-deps

  // lo que recibirán los agentes y cuánto pesa: se recalcula al abrir y tras cada guardado
  useEffect(() => {
    if (!project) { setSources([]); return }
    let live = true
    void window.api.context.sources(project).then((s) => { if (live) setSources(s) })
    return () => { live = false }
  }, [project, state === 'saved', file])  // eslint-disable-line react-hooks/exhaustive-deps

  // al salir del apartado se deja de redactar
  useEffect(() => () => { void window.api.ai.cancel('context') }, [])

  const change = (value: string): void => {
    setText(value); setState('saving')
    if (!file) return
    clearTimeout(timer.current)
    pending.current = { file, value }
    timer.current = setTimeout(() => void flush().then(() => setState('saved')), SAVE_MS)
  }

  const save = async (): Promise<void> => {
    await flush()
    setState('saved')
  }

  const generate = async (): Promise<void> => {
    if (writing || !project) return
    if (text.trim() && !IS_TEMPLATE.test(text) && !window.confirm(t('ctx.replace'))) return
    setWriting(t('git.anAgent'))
    const off = window.api.context.onAgent(setWriting)
    const res = await window.api.context.generate(project)
    off()
    setWriting('')
    if (!res.ok && !res.message) { toast(t('ctx.cancelled'), 'info'); return }
    if (res.ok && res.text) { change(res.text); setMode('view'); toast(t('ctx.generated', { agent: res.agent ? t('ctx.with', { agent: res.agent }) : '' }), 'ok') }
    else toast(res.message || t('ctx.failed'), 'error')
  }

  const total = sources.reduce((n, s) => n + tokensOf(s.chars), 0)

  const Tab = ({ id, label }: { id: Scope; label: string }) => (
    <button onClick={() => { void flush().then(() => setScope(id)) }} disabled={!project}
      className={clsx('flex-1 rounded-md px-2 py-1 text-[12px] transition-colors disabled:cursor-default', active === id ? 'bg-accent-bg font-medium text-accent' : 'text-muted hover:text-text')}>{label}</button>
  )

  return (
    <div className="flex h-full flex-col gap-2 px-2 pb-2">
      <div className="flex gap-1 rounded-lg border border-line p-0.5">
        <Tab id="project" label={t('ctx.tabProject')} /><Tab id="global" label={t('ctx.tabGlobal')} />
      </div>
      <p className="px-1 text-[11px] leading-snug text-muted">{active === 'global' ? t('ctx.helpGlobal') : t('ctx.help')}</p>
      <div className="flex gap-2">
        {active === 'project' && (
          <button onClick={() => void generate()} disabled={!file || !!writing}
            title={t('ctx.generateTip')}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-line px-3 py-1.5 text-[12px] text-accent transition-colors hover:border-accent hover:bg-accent-bg disabled:opacity-60">
            <MdAutoAwesome size={14} className={writing ? 'animate-pulse' : ''} /> <span className="truncate">{writing ? t('ctx.writingWith', { agent: writing }) : t('ctx.generate')}</span>
          </button>
        )}
        <button onClick={() => setMode(mode === 'view' ? 'edit' : 'view')} disabled={!file}
          className="flex items-center justify-center gap-2 rounded-md border border-line px-3 py-1.5 text-[12px] transition-colors hover:border-accent hover:bg-accent-bg disabled:opacity-60">
          {mode === 'view' ? <><MdEdit size={14} /> {t('ctx.edit')}</> : <><MdVisibility size={14} /> {t('ctx.view')}</>}
        </button>
        <button onClick={() => void save()} disabled={!file || state !== 'saving'} title={t('ctx.saveTip')}
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100">
          <MdSave size={14} /> {t('ctx.save')}
        </button>
      </div>
      {mode === 'edit' ? (
        <textarea value={text} onChange={(e) => change(e.target.value)} disabled={!file} spellCheck={false}
          placeholder={active === 'global' ? t('ctx.placeholderGlobal') : t('ctx.placeholder')}
          className="min-h-0 flex-1 resize-none rounded-md bg-ov/[0.04] p-2.5 font-mono text-[12px] leading-relaxed text-text outline-none" />
      ) : (
        <div onDoubleClick={() => setMode('edit')} title={t('ctx.edit')} className="selectable min-h-0 flex-1 cursor-text overflow-y-auto rounded-md bg-ov/[0.04] p-3">
          {text.trim() ? <Markdown text={text} /> : <p className="text-[12px] text-muted">{t('ctx.emptyView')}</p>}
        </div>
      )}
      {project && (
        <div className="rounded-md border border-line">
          <button onClick={() => setShowSources((o) => !o)} aria-expanded={showSources} className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-[11px] text-muted transition-colors hover:text-text">
            <MdChevronRight size={14} className={clsx('shrink-0 transition-transform', showSources && 'rotate-90')} />
            <span className="min-w-0 flex-1 truncate">{t('ctx.receives')}</span>
            <span className={clsx('shrink-0 font-medium', total > BIG_TOKENS ? 'text-danger' : 'text-accent')}>{t('ctx.tokens', { n: total })}</span>
          </button>
          {showSources && (
            <div className="border-t border-line px-2 py-1.5">
              {sources.length === 0 && <p className="text-[11px] text-muted">{t('ctx.nothing')}</p>}
              {sources.map((s) => (
                <p key={s.file} title={s.file} className="flex items-center gap-2 py-0.5 text-[11px]">
                  <span className="min-w-0 flex-1 truncate">{s.kind === 'global' ? t('ctx.tabGlobal') : s.name}</span>
                  {s.mode && <span className="shrink-0 rounded bg-ov/[0.07] px-1.5 py-px text-[9px] font-medium text-muted">{t(`stf.m.${s.mode}` as MsgKey)}{s.delivered === 'index' ? ` · ${t('ctx.listed')}` : ''}</span>}
                  <span className="shrink-0 text-muted">{t('ctx.tokens', { n: tokensOf(s.chars) })}</span>
                </p>
              ))}
              {total > BIG_TOKENS && <p className="pt-1 text-[10px] leading-snug text-danger">{t('ctx.big')}</p>}
              <p className="pt-1 text-[10px] leading-snug text-muted">{t('ctx.steeringHint')}</p>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between px-1 text-[10px] text-muted">
        <span title={file ?? ''} className="min-w-0 truncate">{file ? (active === 'project' && project ? file.replace(project, '').replace(/^[\\/]/, '') : file) : ''}</span>
        <span className="shrink-0">{state === 'saving' ? t('ctx.saving') : state === 'saved' ? t('ctx.savedState') : ''}</span>
      </div>
    </div>
  )
}
