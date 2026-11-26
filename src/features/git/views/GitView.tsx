import { clsx } from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MdAdd, MdUndo, MdArrowDownward, MdArrowUpward, MdCallSplit, MdAutoAwesome, MdCheck, MdChevronRight, MdKeyboardArrowDown, MdOpenInNew, MdOutlineFolder, MdRemove, MdSearch } from 'react-icons/md'
import type { GitFile } from '@/shared/types'
import { GIT_COLOR, refreshGit } from '@/features/git/lib/gitSync'
import { FileIcon } from '@/components/FileIcon'
import { basename, dirname } from '@/lib/paths'
import { useT } from '@/lib/i18n'
import { Menu } from '@/components/Menu'
import { Modal } from '@/components/ui'
import { useStore } from '@/store'

export function GitView() {
  const t = useT()
  const project = useStore((s) => s.project)
  const git = useStore((s) => s.git)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const openDiff = useStore((s) => s.openDiff)
  const set = useStore((s) => s.set)
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<'idle' | 'commit' | 'push' | 'pull' | 'done'>('idle')
  const [busy, setBusy] = useState(false)
  const [discarding, setDiscarding] = useState<GitFile[] | null>(null)          // archivos a los que se les van a deshacer los cambios (tras confirmar)
  const area = useRef<HTMLTextAreaElement>(null)
  const [writing, setWriting] = useState('')            // agente que está redactando (vacío = ninguno)
  const [author, setAuthor] = useState('')              // agente que redactó el mensaje que hay en el input
  const [more, setMore] = useState<DOMRect | null>(null)          // el menú de la flecha del botón (antes de los `return` de abajo: si no, al llegar el estado de git cambia el número de hooks y React tumba la interfaz)

  // al abrir la sección se consulta el remoto (sin tocar nada local) para saber si hay que traer cambios
  useEffect(() => {
    if (!project || !git?.isRepo || !git.hasUpstream) return
    void window.api.git.fetch(project).then(() => refreshGit())
  }, [project, git?.branch, git?.isRepo, git?.hasUpstream])  // eslint-disable-line react-hooks/exhaustive-deps

  // la altura sigue al texto, con tope de 3 líneas (después aparece el scroll)
  useLayoutEffect(() => {
    const el = area.current
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px` }
  }, [message, git?.isRepo])

  // cambios que llegan de fuera del botón (terminal, otro programa): se anima igual que al sincronizar aquí
  const seen = useRef<{ project: string | null; remote: boolean; ahead: number; behind: number } | null>(null)
  useEffect(() => {
    if (!git?.isRepo) { seen.current = null; return }
    const prev = seen.current
    seen.current = { project, remote: git.hasRemote, ahead: git.ahead, behind: git.behind }
    if (!prev || prev.project !== project || busy) return                   // primera lectura, otro proyecto o cambio hecho por el botón
    const synced = git.hasRemote && ((prev.ahead > 0 && git.ahead === 0) || (prev.behind > 0 && git.behind === 0))
    if (synced) { setPhase('done'); setTimeout(() => setPhase('idle'), 1400) }
  }, [git?.isRepo, git?.hasRemote, git?.ahead, git?.behind, project])  // eslint-disable-line react-hooks/exhaustive-deps

  // al salir del apartado se deja de redactar el mensaje
  useEffect(() => () => { void window.api.ai.cancel('commit') }, [])

  if (!project) return <p className="px-3 py-2 text-[12px] text-muted">{t('dlg.openProjectFirst')}</p>
  if (!git?.isRepo) return <p className="px-3 py-2 text-[12px] text-muted">{t('git.noRepo')}</p>

  const run = async (label: string, action: () => Promise<string>): Promise<boolean> => {
    setBusy(true)
    const error = await action()
    setBusy(false)
    await refreshGit()
    if (error) toast(`${label}: ${error}`, 'error')
    return !error
  }
  const hasMessage = message.trim().length > 0
  // sin rama remota asociada no se sabe cuántos commits faltan: se ofrece subir en cuanto no queden cambios por confirmar
  const canPush = git.ahead > 0 || (!git.hasUpstream && git.files.length === 0)
  const action = !git.hasRemote ? { label: 'Commit', icon: 'commit', ready: hasMessage, count: 0, hint: t('git.noRemoteOnlyCommit') }
    : hasMessage ? { label: 'Commit', icon: 'commit', ready: true, count: 0, hint: t('git.commitHint') }
    : git.hasUpstream && git.behind > 0 ? { label: 'Pull', icon: 'pull', ready: true, count: git.behind, hint: t('git.behindHint', { n: git.behind }) }
    : canPush ? { label: 'Push', icon: 'push', ready: true, count: git.ahead, hint: t('git.pushHint') }
    : { label: 'Commit', icon: 'commit', ready: false, count: 0, hint: t('git.writeHint') }
  const iconKey = `${phase}-${action.icon}`
  const staged = git.files.filter((f) => f.index && f.index !== '?')
  const changes = git.files.filter((f) => f.work || f.index === '?')

  const suggest = async (): Promise<void> => {
    if (writing) return
    setWriting(t('git.anAgent'))
    setAuthor('')
    const off = window.api.git.onCommitAgent(setWriting)
    const res = await window.api.git.suggestCommit(project)
    off()
    setWriting('')
    if (res.ok) { setMessage(res.message); setAuthor(res.agent ?? '') }
    else if (res.message) toast(res.message, 'error')
    else toast(t('git.cancelled'), 'info')
  }

  const flash = (): void => { setPhase('done'); setTimeout(() => setPhase('idle'), 1400) }
  /** El botón único, un paso por pulsación: con mensaje hace commit; después pasa a «Push» (o «Pull» si faltan commits del remoto). */
  const sync = async (): Promise<void> => {
    if (busy) return
    const text = message.trim()
    if (text) {
      setPhase('commit')
      if (!(await run('Commit', () => window.api.git.commit(project, text)))) { setPhase('idle'); return }
      setMessage(''); setAuthor('')
      flash()          // el siguiente paso, subirlo, es otra pulsación: el botón pasa a «Push»
    } else if (!git.hasRemote) toast(t('git.noRemote'), 'error')
    else if (git.hasUpstream && git.behind > 0) {
      setPhase('pull')
      if (await run('Pull', () => window.api.git.pull(project))) { flash() } else setPhase('idle')
    } else if (canPush) {
      setPhase('push')
      if (await run('Push', () => window.api.git.push(project))) { flash() } else setPhase('idle')
    } else toast(t('git.writeMessage'), 'error')
  }
  const commit = sync
  /** Las variantes del menú: confirmar, modificar el último, confirmar y subir, confirmar y sincronizar (bajar lo que falte y subir). */
  const commitWith = async (mode: 'commit' | 'amend' | 'push' | 'sync'): Promise<void> => {
    if (busy) return
    const text = message.trim()
    if (!text && mode !== 'amend') { toast(t('git.writeMessage'), 'error'); return }
    if (!git.hasRemote && (mode === 'push' || mode === 'sync')) { toast(t('git.noRemote'), 'error'); return }
    setPhase('commit')
    if (!(await run('Commit', () => window.api.git.commit(project, text, mode === 'amend')))) { setPhase('idle'); return }
    setMessage(''); setAuthor('')
    if (mode === 'sync' && git.hasUpstream) { setPhase('pull'); if (!(await run('Pull', () => window.api.git.pull(project)))) { setPhase('idle'); return } }
    if (mode === 'push' || mode === 'sync') { setPhase('push'); if (!(await run('Push', () => window.api.git.push(project)))) { setPhase('idle'); return } }
    flash()
  }

  const File = ({ f, isStaged }: { f: GitFile; isStaged: boolean }) => (
    <li className="group flex items-center gap-1.5 rounded-md px-1.5 py-[3px] transition-colors hover:bg-ov/[0.05]">
      <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => void (f.code === 'C' ? openDoc(`${project}/${f.path}`) : openDiff(`${project}/${f.path}`, isStaged))} title={t('git.viewChanges')}>
        <FileIcon name={basename(f.path)} className="size-3.5" />
        <span className="truncate text-[12px] text-text">{basename(f.path)}</span>
        <span className="truncate text-[10px] text-muted">{dirname(f.path) === f.path ? '' : dirname(f.path)}</span>
      </button>
      <button title={t('git.openFile')} onClick={() => void openDoc(`${project}/${f.path}`)} className="grid size-4 shrink-0 place-items-center rounded text-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100">
        <MdOpenInNew size={13} />
      </button>
      {!isStaged && (
        <button title={t('git.discard')} onClick={() => setDiscarding([f])} className="grid size-4 shrink-0 place-items-center rounded text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100">
          <MdUndo size={13} />
        </button>
      )}
      <button
        title={isStaged ? t('git.unstageTip') : t('git.stageTip')}
        onClick={() => void run(isStaged ? t('git.unstage') : t('git.stage'), () => (isStaged ? window.api.git.unstage : window.api.git.stage)(project, [f.path]))}
        className="grid size-4 shrink-0 place-items-center rounded text-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
      >
        {isStaged ? <MdRemove size={14} /> : <MdAdd size={14} />}
      </button>
      <Badge code={f.code} color={isStaged ? 'var(--color-git-staged)' : GIT_COLOR[f.code]} />
    </li>
  )

  return (
    <div className="flex h-full flex-col gap-1.5 px-1.5 pt-1">
      {/* la rama, como una tarjeta fina: el nombre y, aparte, lo que falta por bajar o subir y los cambios */}
      <button onClick={() => set({ modal: 'branches' })} className="flex items-center gap-1.5 rounded-lg bg-ov/[0.04] px-2 py-1 text-left ring-1 ring-ov/[0.06] transition-colors hover:bg-ov/[0.07]">
        <MdCallSplit size={13} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{git.branch}</span>
        {git.hasUpstream && git.behind > 0 && <span className="flex shrink-0 items-center rounded-full bg-ov/[0.08] px-1 text-[9.5px] text-muted"><MdArrowDownward size={9} />{git.behind}</span>}
        {git.hasUpstream && git.ahead > 0 && <span className="flex shrink-0 items-center rounded-full bg-ov/[0.08] px-1 text-[9.5px] text-muted"><MdArrowUpward size={9} />{git.ahead}</span>}
        <span className="shrink-0 rounded-full bg-accent/15 px-1.5 text-[9.5px] font-medium leading-4 text-accent">{git.files.length}</span>
      </button>
      {/* el commit: el mensaje y el botón en una misma caja, como la del chat */}
      <div className="flex flex-col gap-1 rounded-lg bg-ov/[0.04] p-1 ring-1 ring-ov/[0.06] focus-within:ring-accent/40">
      <div className="relative">
        {/* mientras un agente redacta el commit: una barra de carga sobre la caja */}
        {writing && <div title={t('git.writingMsg', { agent: writing })} className="absolute inset-x-0 -top-1 h-[2px] overflow-hidden rounded-full bg-accent/20"><div className="h-full w-full animate-sweep bg-gradient-to-r from-transparent via-accent to-transparent" /></div>}
        <textarea
          ref={area} value={message} rows={1} title={author ? `${t('git.writtenBy')} ${author}` : undefined}
          onChange={(e) => { setMessage(e.target.value); setAuthor('') }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void commit() } }}
          placeholder={writing ? t('git.writingMsg', { agent: writing }) : t('git.messagePlaceholder')}
          className="block max-h-[60px] w-full resize-none overflow-y-auto bg-transparent py-1 pl-1 pr-7 text-[12px] leading-snug outline-none placeholder:text-muted/70"
        />
        <button
          title={t('git.generateTip')} disabled={!!writing || busy} onClick={() => void suggest()}
          className={`absolute right-0 top-0 grid size-6 place-items-center rounded-md text-muted transition-colors hover:text-accent disabled:opacity-60 ${writing ? 'animate-pulse text-accent' : ''}`}
        >
          <MdAutoAwesome size={14} />
        </button>
      </div>
      <div className="flex items-stretch">
        <button disabled={busy} onClick={() => void sync()} title={action.hint}
          className={clsx('relative flex h-6 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-l-md text-[11.5px] font-medium transition-colors disabled:cursor-default',
            phase === 'done' ? 'bg-ok/20 text-ok' : action.ready ? 'bg-accent text-bg hover:brightness-110' : 'bg-ov/[0.07] text-muted hover:bg-ov/[0.1] hover:text-text')}>
        {busy && <span className="pointer-events-none absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />}
        <span className="relative flex items-center gap-1.5">
          {/* el icono se vuelve a montar al cambiar (key), así entra con su animación */}
          <span key={iconKey} className="grid size-3.5 animate-icon-swap place-items-center">
            {phase === 'done' ? <MdCheck size={14} className="animate-check-pop" />
              : phase === 'pull' ? <MdArrowDownward size={14} className="animate-bounce" />
              : busy || action.icon === 'push' ? <MdArrowUpward size={14} className={busy ? 'animate-arrow-up' : ''} />
              : action.icon === 'pull' ? <MdArrowDownward size={14} />
              : <MdCheck size={14} />}
          </span>
          {phase === 'commit' ? t('git.committing') : phase === 'push' ? t('git.pushing') : phase === 'pull' ? t('git.pulling') : phase === 'done' ? t('git.done') : action.label}
          {phase === 'idle' && action.count > 0 && <span className="rounded-full bg-bg/25 px-1 text-[9.5px] leading-[14px]">{action.count}</span>}
        </span>
        </button>
        <button disabled={busy} title={t('git.cmMore')} onClick={(e) => setMore(e.currentTarget.getBoundingClientRect())}
          className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-r-md border-l transition-colors disabled:cursor-default',
            phase === 'done' ? 'border-ok/30 bg-ok/20 text-ok' : action.ready ? 'border-bg/25 bg-accent text-bg hover:brightness-110' : 'border-ov/10 bg-ov/[0.07] text-muted hover:bg-ov/[0.1] hover:text-text')}><MdKeyboardArrowDown size={15} /></button>
      </div>
      </div>
      {more && <Menu anchor={more} width={230} alignLeft onClose={() => setMore(null)} items={[
        { label: t('git.cmCommit'), onClick: () => void commitWith('commit') },
        { label: t('git.cmAmend'), onClick: () => void commitWith('amend') },
        { label: t('git.cmPush'), separator: true, onClick: () => void commitWith('push') },
        { label: t('git.cmSync'), onClick: () => void commitWith('sync') }
      ]} />}
      {!git.hasRemote && <p className="-mt-0.5 px-1 text-center text-[10px] text-muted">{t('git.noRemote')}</p>}
      {git.files.some((f) => f.code === 'C') && (
        <div className="flex items-center gap-2 rounded-lg bg-danger/[0.07] px-2 py-1 text-[11px] ring-1 ring-danger/25">
          <span className="min-w-0 flex-1 leading-snug text-muted">{t('git.conflictBanner')}</span>
          <button disabled={busy} onClick={() => void run(t('git.abortOp'), () => window.api.git.abortOp(project))} className="shrink-0 rounded bg-danger/15 px-1.5 py-px text-danger hover:bg-danger/25 disabled:opacity-50">{t('git.abortOp')}</button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {staged.length > 0 && <Group id="staged" title={t('git.staged', { n: staged.length })}>{staged.map((f) => <File key={`s${f.path}`} f={f} isStaged />)}</Group>}
        {git.files.length > 0 && <Group id="changes" title={t('git.changes', { n: changes.length })} actions={changes.length > 0 ? [
          { title: t('git.discardAll'), icon: <MdUndo size={13} />, danger: true, run: () => setDiscarding(changes) },
          { title: t('git.stageAll'), icon: <MdAdd size={14} />, run: () => void run(t('git.stage'), () => window.api.git.stage(project, changes.map((f) => f.path))) }
        ] : undefined}>
          {changes.map((f) => <File key={`c${f.path}`} f={f} isStaged={false} />)}
        </Group>}
        {git.files.length === 0 && (          // sin cambios: un aviso en el centro y atajos a Archivos y Buscar
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 px-4">
            <p className="m-0 text-[12px] text-muted">{t('git.clean')}</p>
            <div className="flex flex-col items-start gap-1">
              <button onClick={() => set({ tab: 'files', sidebarOpen: true })} className="flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-text transition-colors hover:bg-accent-bg"><MdOutlineFolder size={15} className="text-muted" />{t('git.openFiles')}</button>
              <button onClick={() => set({ tab: 'search', sidebarOpen: true })} className="flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-text transition-colors hover:bg-accent-bg"><MdSearch size={15} className="text-muted" />{t('git.searchFiles')}</button>
            </div>
          </div>
        )}
      </div>
      {discarding && <DiscardDialog files={discarding} onClose={() => setDiscarding(null)} onConfirm={(list) => {
        setDiscarding(null)
        void run(t('git.discard'), () => window.api.git.discard(project, list.filter((f) => f.index !== '?').map((f) => f.path), list.filter((f) => f.index === '?').map((f) => f.path))).then((ok) => { if (ok) toast(t('git.discardDone'), 'ok') })
      }} />}
    </div>
  )
}

function Group({ id, title, children, actions }: { id: string; title: string; children: React.ReactNode; actions?: Array<{ title: string; run: () => void; icon: React.ReactNode; danger?: boolean }> }) {
  const [label, count] = title.split(' · ')          // «cambios · 13»: el nombre y, aparte, el número en una píldora
  const key = `tutti.git.${id}.collapsed`
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  const toggle = (): void => {
    setCollapsed((c) => { try { localStorage.setItem(key, c ? '0' : '1') } catch { /* sin almacenamiento */ } return !c })
  }
  return (
    <section className="mb-1.5">
      <div className="flex items-center justify-between py-0.5 pr-1.5">
        <button onClick={toggle} aria-expanded={!collapsed} className="flex min-w-0 flex-1 items-center gap-0.5 rounded px-0.5 text-left text-muted transition-colors hover:text-text">
          <MdChevronRight size={14} className={clsx('shrink-0 transition-transform', !collapsed && 'rotate-90')} />
          <h4 className="truncate text-[10px] font-semibold uppercase tracking-wider">{label}</h4>
          {count && <span className="ml-1 shrink-0 rounded-full bg-ov/[0.08] px-1.5 text-[9.5px] font-medium leading-[14px] text-muted">{count}</span>}
        </button>
        {actions?.map((a) => <button key={a.title} title={a.title} onClick={a.run} className={clsx('grid size-5 place-items-center rounded-md text-muted transition-colors hover:bg-ov/[0.07]', a.danger ? 'hover:text-danger' : 'hover:text-accent')}>{a.icon}</button>)}
      </div>
      {!collapsed && <ul>{children}</ul>}
    </section>
  )
}


/** El estado de un archivo (M, A, D, U, C…) en una insignia teñida de su color. */
function Badge({ code, color }: { code: string; color: string }) {
  return <span className="grid h-3.5 min-w-3.5 shrink-0 place-items-center rounded-[3px] px-0.5 text-[9.5px] font-bold" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>{code}</span>
}

/** Confirmación antes de deshacer cambios: lo ya conocido por git no se puede recuperar; los archivos nuevos van a la papelera. */
function DiscardDialog({ files, onClose, onConfirm }: { files: GitFile[]; onClose: () => void; onConfirm: (files: GitFile[]) => void }) {
  const t = useT()
  const fresh = files.filter((f) => f.index === '?').length
  const one = files.length === 1 ? files[0] : null
  return (
    <Modal onClose={onClose} width={420} title={t('git.discardTitle')}>
      <div className="px-4 pb-4">
        <p className="text-[12px] leading-relaxed text-muted">
          {one ? t(one.index === '?' ? 'git.discardNew' : 'git.discardOne', { name: basename(one.path) }) : t('git.discardMany', { n: files.length })}
          {!one && fresh > 0 && ` ${t('git.discardManyNew', { n: fresh })}`}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button autoFocus onClick={() => onConfirm(files)} className="rounded-lg bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/25">{t('git.discard')}</button>
        </div>
      </div>
    </Modal>
  )
}
