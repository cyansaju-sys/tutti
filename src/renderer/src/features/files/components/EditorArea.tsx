import { clsx } from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MdAccountTree, MdClose, MdNewReleases, MdTune } from 'react-icons/md'
import { VscCode, VscOpenPreview, VscPreview } from 'react-icons/vsc'
import type { GitBlame, GitMarks } from '@/shared/types'
import { refreshGit } from '@/renderer/src/features/git/lib/gitSync'
import { confirmAsk } from '@/renderer/src/shared/lib/confirm'
import { t, useT } from '@/renderer/src/shared/lib/i18n'
import { FileIcon } from '@/renderer/src/shared/components/FileIcon'
import { languageName } from '@/renderer/src/features/files/lib/languages'
import { crumbs, relative, toPosix } from '@/renderer/src/shared/lib/paths'
import { selectionMessage, selectionRef } from '@/renderer/src/features/files/lib/selectionRef'
import { findConflicts, resolveConflict, type Choice } from '@/renderer/src/features/files/lib/conflicts'
import { applyHunks, textHunks, type TextHunk } from '@/renderer/src/features/files/lib/textHunks'
import { isDirty, useStore, type Doc } from '@/renderer/src/shared/store'
import { CodeEditor, type ExternalChange } from './CodeEditor'
import { DiffView } from './DiffView'
import { ImageViewer } from './ImageViewer'
import { Markdown, splitFrontMatter } from './Markdown'
import { GitGraph } from '@/renderer/src/features/git/components/GitGraph'
import { NewsView } from './NewsView'
import { HookFormView } from '@/renderer/src/features/tutti/components/HookFormView'
import { RoleGraphView } from '@/renderer/src/features/tutti/components/RoleGraphView'
import { RoleFormView } from '@/renderer/src/features/tutti/components/RoleFormView'
import { SkillFormView } from '@/renderer/src/features/tutti/components/SkillFormView'
import { SteeringFormView } from '@/renderer/src/features/tutti/components/SteeringFormView'

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

/** Cierra un archivo; si tiene cambios sin guardar, pregunta antes. */
export function closeDocAsk(d: Doc): void {
  if (!isDirty(d)) { useStore.getState().closeDoc(d.path); return }
  void confirmAsk(t('app.unsaved', { title: d.title }), t('app.closeAnyway')).then((yes) => { if (yes) useStore.getState().closeDoc(d.path) })
}

/** Pestaña de un archivo dentro de la barra de pestañas de los agentes (el contenido lo pinta EditorArea con `embedded`). */
export function DocTab({ doc: d, active }: { doc: Doc; active: boolean }) {
  const t = useT()
  const set = useStore((s) => s.set)
  return (
    <div onMouseDown={(e) => { e.preventDefault(); set({ activeDoc: d.path, focus: 'editor' }) }} onAuxClick={(e) => { if (e.button === 1) closeDocAsk(d) }}
      className={clsx('group flex min-w-[110px] max-w-[210px] shrink-0 cursor-pointer h-7 items-center gap-1 rounded-tr-lg border-b border-r border-t-2 border-r-line px-1.5 transition-colors', active ? 'border-b-surface border-t-accent bg-surface text-text' : 'border-b-line border-t-transparent bg-bar text-muted hover:bg-raised')}>
      {d.kind === 'graph' ? <MdAccountTree size={14} className="text-accent" /> : d.kind === 'news' ? <MdNewReleases size={14} className="text-accent" /> : ['hookform', 'steeringform', 'skillform', 'roleform', 'rolegraph', 'news'].includes(d.kind) ? <MdTune size={14} className="text-accent" /> : <FileIcon name={d.title} className="size-3" />}
      <span className="min-w-0 flex-1 truncate text-[10.5px]">{d.title}</span>
      {isDirty(d) && <span title={t('ed.unsavedTip')} className="text-[10px] text-warn">●</span>}
      <button onClick={(e) => { e.stopPropagation(); closeDocAsk(d) }} className="grid size-3.5 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text"><MdClose size={10} /></button>
    </div>
  )
}

export function EditorArea({ embedded = false }: { embedded?: boolean }) {
  const t = useT()
  const docs = useStore((s) => s.docs)
  const activePath = useStore((s) => s.activeDoc)
  const project = useStore((s) => s.project)
  const git = useStore((s) => s.git)
  const editEnabled = useStore((s) => s.editEnabled)
  const focus = useStore((s) => s.focus)
  const reveal = useStore((s) => s.reveal)
  const set = useStore((s) => s.set)
  const updateDocText = useStore((s) => s.updateDocText)
  const [marks, setMarks] = useState<GitMarks>({})
  const [blame, setBlame] = useState<GitBlame | null>(null)
  const [sides, setSides] = useState<Record<string, boolean>>({})          // Markdown con el código a un lado y la vista al otro
  const [previews, setPreviews] = useState<Record<string, boolean>>({})        // vista Markdown por archivo (lo que no está aquí usa su valor por defecto)
  // cambios externos por decidir, por archivo: sobreviven al cambiar de pestaña
  const [pendings, setPendings] = useState<Record<string, PendingExternal>>({})
  const pendingsRef = useRef(pendings)
  pendingsRef.current = pendings
  const doc = docs.find((d) => d.path === activePath) ?? null
  // los .md se pueden ver como Markdown; los de la carpeta .tutti se abren así por defecto
  const isMd = !!doc && doc.kind === 'text' && /\.(md|markdown)$/i.test(doc.path)
  const side = isMd && !!sides[doc!.path]
  const preview = isMd && (previews[doc!.path] ?? /[\\/](\.tutti|\.agents)[\\/]/.test(doc!.path))
  const pending = doc ? pendings[doc.path] ?? null : null
  const conflicts = useMemo(() => (doc?.kind === 'text' && !doc.readOnly ? findConflicts(doc.text) : []), [doc?.kind, doc?.readOnly, doc?.text])
  const resolve = (index: number, choice: Choice): void => {
    if (!doc) return
    updateDocText(doc.path, resolveConflict(doc.text, conflicts[index], choice))
    void saveDoc(useStore.getState().docs.find((d) => d.path === doc.path)!)
  }
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

  const loadMarks = useCallback(async () => {
    if (doc?.kind !== 'text') return
    setMarks(await window.api.git.marks(doc.path))
    setBlame(await window.api.git.blame(doc.path))
  }, [doc?.path])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMarks({}); setBlame(null); void loadMarks() }, [doc?.path, git?.files.length, doc?.savedText])  // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className={clsx('flex min-w-0 flex-1 flex-col overflow-hidden bg-surface', embedded ? 'min-h-0' : 'rounded-lg border border-line')} onMouseDown={() => set({ focus: 'editor' })}>
      {!embedded && <div className="flex shrink-0 overflow-x-auto overflow-y-hidden bg-bar">
        {docs.map((d) => <DocTab key={d.path} doc={d} active={d.path === activePath} />)}
        <div className="min-w-0 flex-1 border-b border-line" />
      </div>}
      {doc && doc.kind !== 'graph' && !['hookform', 'steeringform', 'skillform', 'roleform', 'rolegraph', 'news'].includes(doc.kind) && (
        <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-1.5">
          <div className="flex items-center gap-1 overflow-hidden text-[11px] text-muted">
            {crumbs(project, doc.diffOf ?? doc.path).map((c, i, all) => (
              <span key={i} className="flex items-center gap-1">
                {i === all.length - 1 && <FileIcon name={c} className="size-3 shrink-0" />}
                <span className={clsx('truncate', i === all.length - 1 && 'font-medium text-text')}>{c}</span>
                {i < all.length - 1 && <span className="text-line">›</span>}
              </span>
            ))}
          </div>
          <span className="flex shrink-0 items-center gap-2 pl-3 text-[10px] text-muted">
            {isMd && (
              <button onClick={() => { setSides((p) => ({ ...p, [doc.path]: !side })); setPreviews((p) => ({ ...p, [doc.path]: false })) }} title={t('ed.previewSide')}
                className={clsx('grid size-5 place-items-center rounded-md transition-colors hover:bg-accent-bg hover:text-accent', side && 'bg-accent-bg text-accent')}>
                <VscOpenPreview size={14} />
              </button>
            )}
            {isMd && (
              <button onClick={() => setPreviews((p) => ({ ...p, [doc.path]: !preview }))} title={preview ? t('ed.showSource') : t('ed.showPreview')}
                className="grid size-5 place-items-center rounded-md transition-colors hover:bg-accent-bg hover:text-accent">
                {preview ? <VscCode size={14} /> : <VscPreview size={14} />}
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
      <div className={side ? 'flex min-h-0 min-w-0 flex-1' : 'contents'}>
      {(preview || side) && doc && (() => {
        const { meta, body } = splitFrontMatter(doc.text)
        return (
          <div onDoubleClick={side ? undefined : () => setPreviews((p) => ({ ...p, [doc.path]: false }))} title={side ? undefined : t('ed.showSource')} className={clsx('selectable min-h-0 min-w-0 flex-1 overflow-auto px-4 py-5', side ? 'order-2 border-l border-line' : 'cursor-text')}>
            <div className="mx-auto max-w-5xl">
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
        <div className={side ? 'order-1 flex min-h-0 min-w-0 flex-1 flex-col' : 'contents'}>
        <CodeEditor
          path={doc.path} text={doc.text} readOnly={doc.readOnly || !editEnabled || !!visiblePending} marks={marks} blame={blame} changes={externalChanges}
          onChange={(text) => updateDocText(doc.path, text)} onSave={() => void saveDoc(useStore.getState().docs.find((d) => d.path === doc.path)!)} onResolve={resolve}
          focusToken={focus === 'editor' ? 1 : 0} reveal={reveal}
          onSend={(sel) => sendSelection(doc.path, sel)}
        />
        </div>
      )}
      </div>
      {doc?.kind === 'graph' && <GitGraph />}
      {doc?.kind === 'hookform' && <HookFormView key={doc.path} path={doc.path} />}
      {doc?.kind === 'steeringform' && <SteeringFormView />}
      {doc?.kind === 'skillform' && <SkillFormView />}
      {doc?.kind === 'rolegraph' && <RoleGraphView />}
      {doc?.kind === 'roleform' && <RoleFormView key={doc.path} path={doc.path} />}
      {doc?.kind === 'news' && <NewsView />}
      {doc?.kind === 'diff' && <DiffView before={doc.original ?? ''} after={doc.text} label={doc.diffLabel} />}
      {doc?.kind === 'image' && <ImageViewer src={doc.dataUrl ?? ''} alt={doc.title} />}
      {doc?.kind === 'binary' && <div className="grid flex-1 place-items-center text-[12px] text-muted">{t('ed.binary')}</div>}
    </div>
  )
}
