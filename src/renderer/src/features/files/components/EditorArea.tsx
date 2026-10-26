import { clsx } from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MdAccountTree, MdClose, MdCode, MdTune, MdVisibility } from 'react-icons/md'
import type { GitMarks } from '@shared/types'
import { GIT_COLOR, refreshGit } from '@/features/git/lib/gitSync'
import { confirmAsk } from '@/shared/lib/confirm'
import { t, useT } from '@/shared/lib/i18n'
import { iconFor } from '@/shared/lib/icons'
import { languageName } from '@/features/files/lib/languages'
import { crumbs, relative, toPosix } from '@/shared/lib/paths'
import { selectionMessage, selectionRef } from '@/features/files/lib/selectionRef'
import { applyHunks, textHunks, type TextHunk } from '@/features/files/lib/textHunks'
import { isDirty, useStore, type Doc } from '@/shared/store'
import { CodeEditor, type ExternalChange } from './CodeEditor'
import { DiffView } from './DiffView'
import { Markdown, splitFrontMatter } from './Markdown'
import { GitGraph } from '../../git/components/GitGraph'
import { HookFormView } from '../../tutti/components/HookFormView'
import { SkillFormView } from '../../tutti/components/SkillFormView'
import { SteeringFormView } from '../../tutti/components/SteeringFormView'

export async function saveDoc(doc: Doc): Promise<void> {
  const { toast, markSaved } = useStore.getState()
  try {
    const mtime = await window.api.fs.write(doc.path, doc.text, doc.crlf)
    markSaved(doc.path, doc.text, mtime)
    void refreshGit()
  } catch (e) {
    toast(t('ed.saveFailed', { title: doc.title, error: e instanceof Error ? e.message : String(e) }), 'error')
  }
}

interface PendingExternal {
  path: string
  mtimeMs: number
  before: string
  after: string
  hunks: TextHunk[]
  decided: Set<number>
  accepted: Set<number>
}

export function EditorArea() {
  const t = useT()
  const docs = useStore((s) => s.docs)
  const activePath = useStore((s) => s.activeDoc)
  const project = useStore((s) => s.project)
  const git = useStore((s) => s.git)
  const editEnabled = useStore((s) => s.editEnabled)
  const focus = useStore((s) => s.focus)
  const reveal = useStore((s) => s.reveal)
  const set = useStore((s) => s.set)
  const closeDoc = useStore((s) => s.closeDoc)
  const updateDocText = useStore((s) => s.updateDocText)
  const [marks, setMarks] = useState<GitMarks>({})
  const [previews, setPreviews] = useState<Record<string, boolean>>({})        // vista Markdown por archivo (lo que no está aquí usa su valor por defecto)
  // cambios externos por decidir, por archivo: sobreviven al cambiar de pestaña
  const [pendings, setPendings] = useState<Record<string, PendingExternal>>({})
  const pendingsRef = useRef(pendings)
  pendingsRef.current = pendings
  const doc = docs.find((d) => d.path === activePath) ?? null
  // los .md se pueden ver como Markdown; los de la carpeta .tutti se abren así por defecto
  const isMd = !!doc && doc.kind === 'text' && /\.(md|markdown)$/i.test(doc.path)
  const preview = isMd && (previews[doc!.path] ?? /[\\/](\.tutti|openspec)[\\/]/.test(doc!.path))
  const pending = doc ? pendings[doc.path] ?? null : null
  const setPending = (path: string, value: PendingExternal | null): void =>
    setPendings((all) => { const next = { ...all }; if (value) next[path] = value; else delete next[path]; return next })
  // al cerrar una pestaña se descartan sus cambios pendientes
  useEffect(() => {
    setPendings((all) => {
      const open = new Set(docs.map((d) => d.path))
      const stale = Object.keys(all).filter((path) => !open.has(path))
      if (!stale.length) return all
      const next = { ...all }
      stale.forEach((path) => delete next[path])
      return next
    })
  }, [docs])

  const loadMarks = useCallback(async () => { if (doc?.kind === 'text') setMarks(await window.api.git.marks(doc.path)) }, [doc?.path])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMarks({}); void loadMarks() }, [doc?.path, git?.files.length, doc?.savedText])  // eslint-disable-line react-hooks/exhaustive-deps

  // si otra herramienta cambia el archivo y aquí no hay cambios sin guardar, se recarga solo
  useEffect(() => {
    if (!doc || doc.kind !== 'text') return
    const timer = setInterval(async () => {
      const current = useStore.getState().docs.find((d) => d.path === doc.path)
      if (!current || isDirty(current) || pendingsRef.current[current.path]) return
      const m = await window.api.fs.mtime(current.path)
      if (m && m !== current.mtimeMs) {
        const data = await window.api.fs.read(current.path)
        const hunks = textHunks(current.text, data.text)
        if (hunks.length) setPending(current.path, { path: current.path, mtimeMs: data.mtimeMs, before: current.text, after: data.text, hunks, decided: new Set(), accepted: new Set() })
        else useStore.getState().markExternalSeen(current.path, data.mtimeMs)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [doc?.path])  // eslint-disable-line react-hooks/exhaustive-deps

  const decideExternal = (index: number, accept: boolean): void => {
    if (!pending || !doc) return
    const decided = new Set(pending.decided).add(index)
    const accepted = new Set(pending.accepted)
    if (accept) accepted.add(index); else accepted.delete(index)
    const text = applyHunks(pending.before, pending.hunks, accepted)
    updateDocText(doc.path, text)
    // el disco ya se vio por completo: así, deshacer luego lo aceptado no vuelve a mostrar los mismos tramos
    useStore.getState().markExternalSeen(doc.path, pending.mtimeMs)
    if (decided.size === pending.hunks.length) {
      setPending(doc.path, null)
    } else setPending(doc.path, { ...pending, decided, accepted })
  }
  const decideAllExternal = (accept: boolean): void => {
    if (!pending || !doc) return
    const accepted = accept ? new Set(pending.hunks.map((_, i) => i)) : new Set<number>()
    updateDocText(doc.path, applyHunks(pending.before, pending.hunks, accepted))
    useStore.getState().markExternalSeen(doc.path, pending.mtimeMs)
    setPending(doc.path, null)
  }

  /** Escribe en el prompt del agente activo la referencia al trozo (y el código si es corto), sin enviarla. */
  const sendSelection = (path: string, sel: { startLine: number; endLine: number; text: string }): void => {
    const { panes, activePane, toast } = useStore.getState()
    const pane = panes.find((p) => p.id === activePane && p.kind === 'agent') ?? panes.find((p) => p.kind === 'agent')
    if (!pane || !project) { toast(t('ed.noAgent'), 'error'); return }
    const rel = toPosix(relative(project, path))
    window.api.pty.paste(pane.id, selectionMessage(pane.command, rel, sel.startLine, sel.endLine, sel.text))
    useStore.getState().focusPane(pane.id)
  }
  const close = (d: Doc): void => {
    if (!isDirty(d)) { closeDoc(d.path); return }
    void confirmAsk(t('app.unsaved', { title: d.title }), t('app.closeAnyway')).then((yes) => { if (yes) closeDoc(d.path) })
  }
  const statusOf = (d: Doc): string => {
    const rel = project ? toPosix(relative(project, d.diffOf ?? d.path)) : ''
    return git?.files.find((f) => toPosix(f.path) === rel)?.code ?? ''
  }
  const visiblePending = pending
  // posición de cada tramo sin decidir en el texto actual: los ya aceptados desplazan las líneas siguientes
  const externalChanges = useMemo<ExternalChange[]>(() => {
    if (!pending) return []
    let shift = 0
    const out: ExternalChange[] = []
    pending.hunks.forEach((h, i) => {
      if (!pending.decided.has(i)) out.push({ line: h.beforeStart + shift, removed: h.beforeLines.length, added: h.afterLines })
      else if (pending.accepted.has(i)) shift += h.afterLines.length - h.beforeLines.length
    })
    return out
  }, [pending])

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface" onMouseDown={() => set({ focus: 'editor' })}>
      <div className="flex shrink-0 items-end overflow-x-auto bg-bar pt-1">
        {docs.map((d) => {
          const active = d.path === activePath
          const code = statusOf(d)
          return (
            <div
              key={d.path} ref={active ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) : undefined}
              onClick={() => set({ activeDoc: d.path, focus: 'editor' })}
              onAuxClick={(e) => { if (e.button === 1) close(d) }}
              className={clsx(
                'group flex shrink-0 cursor-pointer items-center gap-1.5 border-t-2 px-3 py-[7px] transition-colors',
                active ? 'border-accent bg-surface text-text' : 'border-panel bg-panel text-muted hover:bg-raised'
              )}
            >
              {d.kind === 'graph' ? <MdAccountTree size={15} className="text-accent" /> : ['hookform', 'steeringform', 'skillform'].includes(d.kind) ? <MdTune size={15} className="text-accent" /> : <img src={iconFor(d.title)} alt="" className="size-4" draggable={false} />}
              <span className="max-w-[160px] truncate text-[12px]" style={{ color: code ? GIT_COLOR[code] : undefined }}>{d.title}</span>
              {code && <span className="text-[10px] font-semibold" style={{ color: GIT_COLOR[code] }}>{code}</span>}
              {isDirty(d) && <span title={t('ed.unsavedTip')} className="text-[10px] text-warn">●</span>}
              <button onClick={(e) => { e.stopPropagation(); close(d) }} className="grid size-5 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text">
                <MdClose size={12} />
              </button>
            </div>
          )
        })}
      </div>
      {doc && doc.kind !== 'graph' && !['hookform', 'steeringform', 'skillform'].includes(doc.kind) && (
        <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-1.5">
          <div className="flex items-center gap-1 overflow-hidden text-[11px] text-muted">
            {crumbs(project, doc.diffOf ?? doc.path).map((c, i, all) => (
              <span key={i} className="flex items-center gap-1">
                <span className={clsx('truncate', i === all.length - 1 && 'font-medium text-text')}>{c}</span>
                {i < all.length - 1 && <span className="text-line">›</span>}
              </span>
            ))}
          </div>
          <span className="flex shrink-0 items-center gap-2 pl-3 text-[10px] text-muted">
            {isMd && (
              <button onClick={() => setPreviews((p) => ({ ...p, [doc.path]: !preview }))} title={preview ? t('ed.showSource') : t('ed.showPreview')}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors hover:bg-accent-bg hover:text-accent">
                {preview ? <><MdCode size={14} /> {t('ed.source')}</> : <><MdVisibility size={14} /> {t('ed.preview')}</>}
              </button>
            )}
            {doc.kind === 'diff' ? t('ed.comparison') : languageName(doc.title)}
          </span>
        </div>
      )}
      {doc && (doc.readOnly || !editEnabled) && doc.kind === 'text' && (
        <div className="shrink-0 bg-raised px-3 py-1 text-[10px] text-warn">
          {doc.truncated ? t('ed.firstMb') : doc.readOnly ? t('ed.tooBig') : t('ed.locked')}
        </div>
      )}
      {visiblePending && (
        <div className="shrink-0 border-b border-warn/30 bg-warn/[0.08] px-3 py-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-warn">{t('ed.externalTitle')}</span>
            <span className="text-muted">{t('ed.externalHint')}</span>
            <button onClick={() => decideAllExternal(true)} className="ml-auto rounded bg-ok/15 px-2 py-1 text-ok hover:bg-ok/25">{t('ed.externalAcceptAll')}</button>
            <button onClick={() => decideAllExternal(false)} className="rounded bg-danger/15 px-2 py-1 text-danger hover:bg-danger/25">{t('ed.externalRejectAll')}</button>
          </div>
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {visiblePending.hunks.map((hunk, i) => !visiblePending.decided.has(i) && (
              <details key={i} className="rounded border border-line bg-surface/50">
                <summary className="flex cursor-pointer items-center gap-2 px-2 py-1">
                  <span className="font-medium">{t('ed.externalHunk', { n: i + 1 })}</span>
                  <span className="text-muted">{hunk.afterLines.length ? `+${hunk.afterLines.length}` : ''}{hunk.beforeLines.length ? ` −${hunk.beforeLines.length}` : ''}</span>
                  <span className="ml-auto flex gap-1">
                    <button onClick={(e) => { e.preventDefault(); decideExternal(i, true) }} className="rounded px-1.5 text-ok hover:bg-ok/15">{t('ed.externalAccept')}</button>
                    <button onClick={(e) => { e.preventDefault(); decideExternal(i, false) }} className="rounded px-1.5 text-danger hover:bg-danger/15">{t('ed.externalReject')}</button>
                  </span>
                </summary>
                <div className="grid grid-cols-2 gap-px border-t border-line bg-line font-mono text-[10px]">
                  <pre className="overflow-x-auto bg-danger/[0.08] p-1.5 whitespace-pre-wrap">{hunk.beforeLines.join('\n') || '∅'}</pre>
                  <pre className="overflow-x-auto bg-ok/[0.08] p-1.5 whitespace-pre-wrap">{hunk.afterLines.join('\n') || '∅'}</pre>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
      {preview && doc && (() => {
        const { meta, body } = splitFrontMatter(doc.text)
        return (
          <div onDoubleClick={() => setPreviews((p) => ({ ...p, [doc.path]: false }))} title={t('ed.showSource')} className="selectable min-h-0 flex-1 cursor-text overflow-y-auto px-6 py-5">
            <div className="mx-auto max-w-3xl">
              {meta.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {meta.map(([k, v]) => <span key={k} className="rounded-full bg-ov/[0.07] px-2.5 py-0.5 text-[10px] text-muted"><b className="font-semibold text-accent">{k}</b> {v}</span>)}
                </div>
              )}
              {body.trim() ? <Markdown text={body} /> : <p className="text-[12px] text-muted">{t('ctx.emptyView')}</p>}
            </div>
          </div>
        )
      })()}
      {doc?.kind === 'text' && !preview && (
        <CodeEditor
          path={doc.path} text={doc.text} readOnly={doc.readOnly || !editEnabled || !!visiblePending} marks={marks} changes={externalChanges}
          onChange={(text) => updateDocText(doc.path, text)} onSave={() => void saveDoc(useStore.getState().docs.find((d) => d.path === doc.path)!)}
          focusToken={focus === 'editor' ? 1 : 0} reveal={reveal}
          onSend={(sel) => sendSelection(doc.path, sel)}
          onSelect={(sel) => useStore.setState({ editorSelection: { path: doc.path, ...sel } })}
        />
      )}
      {doc?.kind === 'graph' && <GitGraph />}
      {doc?.kind === 'hookform' && <HookFormView key={doc.path} path={doc.path} />}
      {doc?.kind === 'steeringform' && <SteeringFormView />}
      {doc?.kind === 'skillform' && <SkillFormView />}
      {doc?.kind === 'diff' && <DiffView before={doc.original ?? ''} after={doc.text} label={doc.diffLabel} />}
      {doc?.kind === 'image' && <div className="grid flex-1 place-items-center overflow-auto p-4"><img src={doc.dataUrl} alt={doc.title} className="max-h-full max-w-full object-contain" /></div>}
      {doc?.kind === 'binary' && <div className="grid flex-1 place-items-center text-[12px] text-muted">{t('ed.binary')}</div>}
    </div>
  )
}
