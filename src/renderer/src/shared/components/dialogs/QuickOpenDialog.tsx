import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import { loadRecentFiles } from '@/renderer/src/shared/store/recentFiles'
import { FileIcon } from '@/renderer/src/shared/components/FileIcon'
import { basename, relative, toPosix } from '@/renderer/src/shared/lib/paths'
import { Modal } from '@/renderer/src/shared/components/ui'
import { listProjectFiles } from '@/renderer/src/shared/lib/projectFiles'
import { Palette } from './Palette'

export function QuickOpenDialog() {
  const t = useT()
  const project = useStore((s) => s.project)
  const openDoc = useStore((s) => s.openDoc)
  const set = useStore((s) => s.set)
  const [files, setFiles] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  useEffect(() => { if (project) void loadRecentFiles(project).then(setRecent) }, [project])
  const opened = useMemo(() => { const all = new Set(files); return recent.filter((p) => all.has(p)) }, [recent, files])          // lo que se abrió y sigue existiendo
  useEffect(() => {
    if (!project) return
    let cancelled = false
    void listProjectFiles(project).then((paths) => { if (!cancelled) setFiles(paths) })
    return () => { cancelled = true }
  }, [project])
  if (!project) return <Modal onClose={() => set({ modal: null })} width={560}><p className="px-4 py-5 text-[12px] text-muted">{t('dlg.openProjectFirst')}</p></Modal>
  return <Modal onClose={() => set({ modal: null })} width={560}>
    <Palette
      placeholder={t('dlg.quickOpen')} items={files} initial={opened} emptyInitial={t('dlg.quickOpenHint')} label={(path) => toPosix(relative(project, path))} empty={t('dlg.noFileMatch')}
      render={(path, active) => <><FileIcon name={basename(path)} /><span className="truncate">{toPosix(relative(project, path))}</span></>}
      onPick={(path) => { if (path) { set({ modal: null }); void openDoc(path) } }}
    />
  </Modal>
}
