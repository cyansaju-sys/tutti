import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { MdWarningAmber, MdAccountTree, MdCallSplit, MdCheckCircle, MdErrorOutline, MdInfoOutline, MdNewReleases, MdNotificationsNone, MdPlaylistRemove } from 'react-icons/md'
import { useT } from '@/lib/i18n'
import { useStore } from '@/store'
import { Chip } from './ui'
import { useProblems } from '@/features/agents/lib/problems'

const ICON = {
  ok: <MdCheckCircle size={17} className="text-ok" />,
  error: <MdErrorOutline size={17} className="text-danger" />,
  info: <MdInfoOutline size={17} className="text-accent" />
}

/** El pie de la ventana: a la izquierda la rama y los commits; a la derecha la campana con el historial de avisos y las novedades. */
export function Footer() {
  const t = useT()
  const git = useStore((s) => s.git)
  const set = useStore((s) => s.set)
  const openGraph = useStore((s) => s.openGraph)
  const openNews = useStore((s) => s.openNews)
  const notices = useStore((s) => s.notices)
  const clearNotices = useStore((s) => s.clearNotices)
  const [open, setOpen] = useState(false)
  const problems = useProblems()
  const errors = problems.filter((p) => p.kind === 'error').length
  const warnings = problems.length - errors
  const panelTab = useStore((s) => s.panelTab)
  const showing = useStore((s) => s.shells.length > 0 || s.problemsOpen)
  const hasShells = useStore((s) => s.shells.length > 0)
  // el contador abre la pestaña Problemas del panel de abajo; si ya se ve, la cierra (o vuelve a la terminal)
  const toggleProblems = (): void => {
    if (showing && panelTab === 'problems') { if (hasShells) set({ panelTab: 'terminal' }); else set({ problemsOpen: false }); return }
    set({ problemsOpen: true, panelTab: 'problems' })
  }
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', down); window.addEventListener('keydown', key)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', key) }
  }, [open])

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-line bg-panel px-2.5 [&_button]:py-0">
      <div className="flex items-center gap-1">
        <button onClick={toggleProblems} title={t('pb.title')} className={clsx('flex items-center gap-2 rounded px-1.5 text-[11px] font-light transition-colors hover:bg-accent-bg', showing && panelTab === 'problems' ? 'bg-accent-bg text-text' : 'text-muted')}>
          <span className="flex items-center gap-0.5"><MdErrorOutline size={13} className={errors ? 'text-danger' : ''} />{errors}</span>
          <span className="flex items-center gap-0.5"><MdWarningAmber size={13} className={warnings ? 'text-warn' : ''} />{warnings}</span>
        </button>
        {git?.isRepo && (
          <>
            <Chip icon={<MdCallSplit size={14} />} label={git.branch} onClick={() => set({ modal: 'branches' })} title={t('title.changeBranch')} />
            <Chip icon={<MdAccountTree size={14} />} label={t('title.commits')} onClick={() => openGraph()} title={t('title.commitsTip')} />
          </>
        )}
      </div>
      <div ref={box} className="relative">
        {open && (
          <div className="absolute bottom-[calc(100%+6px)] right-0 z-[70] flex max-h-[50vh] w-[360px] flex-col overflow-hidden rounded-lg border border-line bg-raised/85 backdrop-blur-md shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)]">
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1">
              <span className="text-[11px] font-semibold">{notices.length ? t('notif.title') : t('notif.empty')}</span>
              <div className="flex items-center gap-0.5">
                <button title={t('notif.news')} onClick={() => { setOpen(false); openNews(null) }} className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-accent"><MdNewReleases size={14} /></button>
                <button title={t('notif.clear')} disabled={!notices.length} onClick={clearNotices} className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text disabled:opacity-40"><MdPlaylistRemove size={15} /></button>
              </div>
            </div>
            {notices.length > 0 && (
              <div className="flex min-h-0 flex-col overflow-y-auto border-t border-line">
                {notices.map((n) => (
                  <div key={n.id} className="flex items-start gap-2.5 border-b border-line/60 px-3 py-2 last:border-b-0">
                    <span className="mt-px shrink-0">{ICON[n.kind]}</span>
                    <span className="text-[12px] leading-snug">{n.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={() => setOpen((o) => !o)} title={t('notif.title')}
          className={clsx('relative grid size-[22px] place-items-center rounded transition-colors hover:text-accent', open ? 'bg-accent-bg text-accent' : 'text-muted')}>
          <MdNotificationsNone size={17} />
          {notices.length > 0 && <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-accent" />}
        </button>
      </div>
    </div>
  )
}
