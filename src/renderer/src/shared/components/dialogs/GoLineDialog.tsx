import { useState } from 'react'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import { FIELD, Modal } from '@/renderer/src/shared/components/ui'

export function GoLineDialog() {
  const t = useT()
  const set = useStore((s) => s.set)
  const active = useStore((s) => s.docs.find((d) => d.path === s.activeDoc))
  const [value, setValue] = useState('')
  const submit = (): void => {
    const line = Number.parseInt(value, 10)
    if (!active || active.kind !== 'text' || !Number.isFinite(line) || line < 1) return
    set({ modal: null, reveal: { path: active.path, line, col: 0, length: 0, token: Date.now() }, focus: 'editor' })
  }
  return <Modal onClose={() => set({ modal: null })} width={360} title={t('dlg.goLine')}>
    <div className="flex flex-col gap-3 px-4 pb-4">
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} placeholder={t('dlg.lineNumber')} inputMode="numeric" className={FIELD} />
      {!active || active.kind !== 'text' ? <p className="text-[12px] text-muted">{t('dlg.noTextFile')}</p> : <p className="text-[11px] text-muted">{active.title}</p>}
      <div className="flex justify-end"><button onClick={submit} disabled={!active || active.kind !== 'text' || !value} className="rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-medium text-bg transition-colors hover:brightness-110 disabled:opacity-40">{t('dlg.go')}</button></div>
    </div>
  </Modal>
}
