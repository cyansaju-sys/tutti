import { useEffect, useState } from 'react'
import { isHubLayout } from '@/lib/hub'
import { createPortal } from 'react-dom'
import { MdOutlineForum, MdCropSquare, MdClose, MdFileDownload, MdOpenInNew, MdRefresh, MdRemove } from 'react-icons/md'
import { useT } from '@/lib/i18n'
import { useStore } from '@/store'
import { Chip, IconButton } from './ui'
import { Menu, type MenuItem } from './Menu'
import { confirmAsk } from '@/lib/confirm'
import { basename } from '@/lib/paths'
import { bindingOf } from '@/lib/keybindings'
import { isDirty } from '@/store/docs'
import { saveDoc, closeDocAsk } from '@/features/files/components/EditorArea'

/** Botón de actualización: solo aparece cuando hay una release nueva (o mientras se descarga). */
function UpdateButton() {
  const t = useT()
  const update = useStore((s) => s.update)
  const base = 'no-drag relative mr-1 flex h-[24px] items-center gap-1.5 overflow-hidden rounded-full px-3 text-[11px] font-medium transition-colors'
  if (update.status === 'available') {
    return (
      <button onClick={() => void window.api.update.install()} title={update.canInstall ? t('title.updateInstall') : t('title.updateOpen')}
        className={`${base} bg-accent text-bg hover:brightness-110`}>
        {update.canInstall ? <MdFileDownload size={14} /> : <MdOpenInNew size={13} />}
        {update.canInstall ? t('title.updateTo', { v: update.version }) : t('title.newVersion', { v: update.version })}
      </button>
    )
  }
  if (update.status === 'downloading') {
    return (
      <div className={`${base} bg-accent-bg text-accent`}>
        <span className="absolute inset-y-0 left-0 bg-accent/30 transition-all" style={{ width: `${update.percent}%` }} />
        <MdFileDownload size={14} className="relative" /><span className="relative tabular-nums">{t('title.downloading', { percent: update.percent })}</span>
      </div>
    )
  }
  if (update.status === 'restarting') return <div className={`${base} bg-accent-bg text-accent`}><MdRefresh size={14} className="animate-spin" />{t('title.restarting')}</div>
  if (update.status === 'error') {
    return (
      <button onClick={() => void window.api.update.check()} title={update.message} className={`${base} bg-danger/15 text-danger hover:bg-danger/25`}>
        <MdRefresh size={14} />{t('title.retryUpdate')}
      </button>
    )
  }
  return null
}

/** El menú Archivo: lo que la app ya sabe hacer con archivos, carpetas y la ventana (los atajos que se muestran son los que ya funcionan). */
function fileItems(t: ReturnType<typeof useT>): MenuItem[] {
  const st = useStore.getState()
  const doc = st.docs.find((d) => d.path === st.activeDoc && !d.diffOf)
  const dirty = st.docs.filter((d) => !d.diffOf && d.original === undefined && isDirty(d))
  const recent = st.recentProjects.filter((p) => p !== st.project)
  const revert = async (): Promise<void> => {
    if (!doc) return
    if (isDirty(doc) && !(await confirmAsk(t('title.file.revertAsk', { title: doc.title }), t('title.file.revertYes')))) return
    const data = await window.api.fs.read(doc.path)
    useStore.getState().updateDocText(doc.path, data.text)
    useStore.getState().markSaved(doc.path, data.text, data.mtimeMs)
  }
  return [
    { label: t('title.file.newWindow'), detail: 'Ctrl+Mayús+N', onClick: () => window.api.window.openNew() },
    { label: t('title.file.openFile'), detail: bindingOf('quickOpen', st.keys), separator: true, onClick: () => st.set({ modal: 'quickOpen' }), hidden: !st.project },
    { label: t('title.file.openFolder'), detail: 'Ctrl+K Ctrl+O', onClick: () => void window.api.dialog.chooseFolder(st.project ?? undefined).then((p) => { if (p) useStore.getState().setProject(p) }) },
    { label: t('title.file.openRecent'), submenu: recent.length ? recent.map((p) => ({ label: basename(p), detail: undefined, onClick: () => useStore.getState().setProject(p) })) : [{ label: t('title.file.noRecent') }] },
    { label: t('title.file.save'), detail: 'Ctrl+S', separator: true, hidden: !doc || doc.kind !== 'text', onClick: () => { if (doc) void saveDoc(doc) } },
    { label: t('title.file.saveAll'), hidden: !dirty.length, onClick: () => { dirty.forEach((d) => void saveDoc(d)) } },
    { label: t('title.file.revert'), hidden: !doc || doc.kind !== 'text', onClick: () => void revert() },
    { label: t('title.file.closeEditor'), detail: 'Ctrl+W', separator: true, hidden: !doc, onClick: () => { if (doc) closeDocAsk(doc) } },
    { label: t('title.file.closeFolder'), hidden: !st.project, onClick: () => useStore.getState().setProject(null) },
    { label: t('title.file.closeWindow'), detail: 'Alt+F4', onClick: () => window.api.window.close() },
    { label: t('title.file.exit'), detail: 'Ctrl+Q', onClick: () => window.api.window.close() }
  ]
}

export function TitleBar() {
  const t = useT()
  const shell = useStore((s) => s.shells.length > 0)
  const set = useStore((s) => s.set)
  const toggleShell = useStore((s) => s.toggleShell)
  const addShell = useStore((s) => s.addShell)
  const project = useStore((s) => s.project)
  const chatOpen = useStore((s) => s.chatOpen)
  const hub = useStore(isHubLayout)
  const editorFull = useStore((s) => s.editorFull)          // el chat es solo del «Modo agentes»: en el modo normal (terminal) no hay botón
  const projectName = project?.split(/[\\/]/).filter(Boolean).pop()

  const [fileMenu, setFileMenu] = useState<DOMRect | null>(null)
  const [termMenu, setTermMenu] = useState<DOMRect | null>(null)
  useEffect(() => window.api.window.onMaximized((maximized) => set({ maximized })), [set])

  return (
    <div className="drag relative flex h-[34px] shrink-0 items-center justify-between bg-bg pl-3 pr-1" onDoubleClick={() => window.api.window.toggleMaximize()}>
      <div className="flex items-center gap-1">
        <Chip label={t('title.file.file')} open={!!fileMenu} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFileMenu(new DOMRect(r.left, r.bottom, 260, 0)) }} />
        <Chip label={t('title.terminal')} active={shell} open={!!termMenu} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTermMenu(new DOMRect(r.left, r.bottom, 220, 0)) }} title={t('title.terminalTip')} />
      </div>
      {/* el nombre del proyecto, centrado en la ventana; no recibe clics: la barra sigue arrastrándose por ahí */}
      {projectName && (
        <span title={project ?? undefined} className="pointer-events-none absolute left-1/2 top-1/2 flex max-w-[34%] -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-[12px] font-medium text-muted">
          <span className="truncate">{projectName}</span>{editorFull && !hub && <button title={t('chat.title')} onClick={() => set({ chatOpen: !chatOpen })} className={`no-drag pointer-events-auto grid shrink-0 place-items-center rounded transition-colors hover:text-text ${chatOpen ? 'text-accent' : ''}`}><MdOutlineForum size={15} /></button>}          {/* en la vista de agentes el chat es la vista: no hace falta */}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <UpdateButton />
        <IconButton className="!h-[20px]" title={t('title.minimize')} onClick={() => window.api.window.minimize()}><MdRemove size={16} className="translate-y-[3px]" /></IconButton>
        <IconButton className="!h-[20px]" title={t('title.maximize')} onClick={() => window.api.window.toggleMaximize()}><MdCropSquare size={15} /></IconButton>
        <IconButton className="!h-[20px]" title={t('title.close')} danger onClick={() => window.api.window.close()}><MdClose size={16} /></IconButton>
      </div>
      {fileMenu && createPortal(<Menu alignLeft width={260} anchor={fileMenu} onClose={() => setFileMenu(null)} items={fileItems(t)} />, document.body)}
      {termMenu && createPortal(      // fuera de la barra: dentro de ella el menú heredaría la región de arrastre y la ventana entera se tragaría los clics
        <Menu alignLeft width={220} anchor={termMenu} onClose={() => setTermMenu(null)} items={[
          { label: t('title.newTerminal'), onClick: () => void addShell() },
          { label: shell ? t('title.closeTerminals') : t('title.openTerminal'), separator: true, onClick: () => void toggleShell() }
        ]} />, document.body
      )}
    </div>
  )
}
