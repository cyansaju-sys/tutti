import { useEffect, useState } from 'react'
import { MdAccountTree, MdCallSplit } from 'react-icons/md'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { Chip } from './ui'

/** El pie de la ventana: a la izquierda la rama y los commits; a la derecha la versión (al pulsarla, las novedades). */
export function Footer() {
  const t = useT()
  const git = useStore((s) => s.git)
  const set = useStore((s) => s.set)
  const openGraph = useStore((s) => s.openGraph)
  const [version, setVersion] = useState('')
  useEffect(() => { void window.api.update.version().then(setVersion) }, [])

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-line bg-panel px-2.5 [&_button]:py-0">
      <div className="flex items-center gap-1">
        {git?.isRepo && (
          <>
            <Chip icon={<MdCallSplit size={14} />} label={git.branch} onClick={() => set({ modal: 'branches' })} title={t('title.changeBranch')} />
            <Chip icon={<MdAccountTree size={14} />} label={t('title.commits')} onClick={() => openGraph()} title={t('title.commitsTip')} />
          </>
        )}
      </div>
      {version && <button onClick={() => set({ modal: 'news', newsSince: null })} title={t('title.news')} className="text-[11px] text-muted opacity-70 transition-opacity hover:text-accent hover:opacity-100">v{version}</button>}
    </div>
  )
}
