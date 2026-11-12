import { useEffect, useState } from 'react'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { FIELD, Modal } from '@/shared/components/ui'

/** Ajuste del ejecutable que abre la terminal; vacío usa el del sistema. */
export function ShellDialog() {
  const t = useT()
  const set = useStore((s) => s.set)
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { void window.api.settings.get('default_shell').then((v) => { if (typeof v === 'string') setPath(v) }) }, [])
  const save = async (): Promise<void> => {
    const r = await window.api.agents.setShell(path)
    if (!r.ok) { setError(r.message); return }
    set({ modal: null, focus: 'pane' })
  }
  return (
    <Modal onClose={() => set({ modal: null, focus: 'pane' })} width={500} title={t('dlg.shell')}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-[12px] text-muted">{t('dlg.shellHelp')}</p>
        <input className={FIELD} placeholder={t('dlg.shellPlaceholder')} value={path} autoFocus
          onChange={(e) => { setPath(e.target.value); setError('') }} onKeyDown={(e) => { if (e.key === 'Enter') void save() }} spellCheck={false} />
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => set({ modal: null, focus: 'pane' })} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:bg-ov/[0.06]">{t('dlg.cancel')}</button>
          <button onClick={() => void save()}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-medium text-bg transition-colors hover:brightness-110">{t('us.save')}</button>
        </div>
      </div>
    </Modal>
  )
}
