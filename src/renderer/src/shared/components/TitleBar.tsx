import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MdAdd, MdChatBubbleOutline, MdCropSquare, MdClose, MdEdit, MdEditOff, MdFileDownload, MdKeyboard, MdKeyboardArrowDown, MdOpenInNew, MdRefresh, MdRemove, MdTerminal } from 'react-icons/md'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { Chip, IconButton } from './ui'
import { Menu } from './Menu'

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

export function TitleBar() {
  const t = useT()
  const shell = useStore((s) => s.shells.length > 0)
  const editEnabled = useStore((s) => s.editEnabled)
  const set = useStore((s) => s.set)
  const setEdit = useStore((s) => s.setEdit)
  const chatOpen = useStore((s) => s.chatOpen)
  const toggleShell = useStore((s) => s.toggleShell)
  const addShell = useStore((s) => s.addShell)

  const [termMenu, setTermMenu] = useState<DOMRect | null>(null)
  useEffect(() => window.api.window.onMaximized((maximized) => set({ maximized })), [set])

  return (
    <div className="drag flex h-[34px] shrink-0 items-center justify-between bg-bg pl-3 pr-1" onDoubleClick={() => window.api.window.toggleMaximize()}>
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-medium text-muted">Tutti</span>
        <Chip icon={<MdTerminal size={14} />} label={t('title.terminal')} active={shell} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTermMenu(new DOMRect(r.left, r.bottom, 220, 0)) }} title={t('title.terminalTip')} />
        <Chip
          icon={editEnabled ? <MdEdit size={14} /> : <MdEditOff size={14} />}
          label={editEnabled ? t('title.editing') : t('title.readOnly')}
          onClick={() => setEdit(!editEnabled)}
          title={t('title.editTip')}
        />
      </div>
      <div className="flex items-center gap-0.5">
        <UpdateButton />
        <IconButton title={t('title.chat')} onClick={() => set({ chatOpen: !chatOpen })} className={chatOpen ? 'bg-accent-bg text-accent' : undefined}><MdChatBubbleOutline size={15} /></IconButton>
        <IconButton title={t('title.newWindow')} onClick={() => window.api.window.openNew()}><MdOpenInNew size={15} /></IconButton>
        <IconButton title={t('title.shortcuts')} onClick={() => set({ modal: 'shortcuts' })}><MdKeyboard size={16} /></IconButton>
        <IconButton title={t('title.minimize')} onClick={() => window.api.window.minimize()}><MdRemove size={16} /></IconButton>
        <IconButton title={t('title.maximize')} onClick={() => window.api.window.toggleMaximize()}><MdCropSquare size={15} /></IconButton>
        <IconButton title={t('title.close')} danger onClick={() => window.api.window.close()}><MdClose size={16} /></IconButton>
      </div>
      <MdKeyboardArrowDown className="hidden" />
      {termMenu && createPortal(      // fuera de la barra: dentro de ella el menú heredaría la región de arrastre y la ventana entera se tragaría los clics
        <Menu width={220} anchor={termMenu} onClose={() => setTermMenu(null)} items={[
          { label: t('title.newTerminal'), icon: <MdAdd size={15} />, onClick: () => void addShell() },
          { label: shell ? t('title.closeTerminals') : t('title.openTerminal'), separator: true, icon: <MdTerminal size={15} />, onClick: () => void toggleShell() }
        ]} />, document.body
      )}
    </div>
  )
}
