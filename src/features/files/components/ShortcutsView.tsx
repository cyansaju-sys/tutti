import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { MdRestartAlt } from 'react-icons/md'
import type { MsgKey } from '@/shared/i18n'
import { useT } from '@/lib/i18n'
import { SECTIONS } from '@/lib/shortcuts'
import { bindingOf, comboOf, conflictOf, formatCombo, isAssignable, setCapturing, COMMANDS } from '@/lib/keybindings'
import { useStore } from '@/store'
import { Kbd } from '@/components/ui'

/** Las teclas de un atajo que se puede cambiar: un clic y se pulsan las nuevas (Esc cancela). */
function KeyCell({ id }: { id: string }) {
  const t = useT()
  const keys = useStore((s) => s.keys)
  const setKey = useStore((s) => s.setKey)
  const toast = useStore((s) => s.toast)
  const [listening, setListening] = useState(false)
  const changed = id in keys

  useEffect(() => {
    if (!listening) return
    setCapturing(true)
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault(); e.stopPropagation()
      if (e.key === 'Escape') { setListening(false); return }
      const combo = comboOf(e)
      if (!combo) return          // solo un modificador: se espera al resto
      if (!isAssignable(combo)) { toast(t('sc.invalid'), 'info'); return }
      const clash = conflictOf(combo, id, useStore.getState().keys)
      if (clash) { toast(clash === 'reserved' ? t('sc.reserved') : t('sc.taken', { action: t(clash.label) }), 'error'); return }
      setKey(id, combo === COMMANDS.find((c) => c.id === id)?.combo ? null : combo)
      setListening(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); setCapturing(false) }
  }, [listening, id, setKey, toast, t])

  return (
    <div className="flex items-center gap-2">
      <button title={t('sc.editTip')} onClick={() => setListening(true)} onBlur={() => setListening(false)}
        className={clsx('rounded-[3px] border px-1.5 py-0.5 text-[11px] transition-colors', listening ? 'border-accent text-accent' : 'border-transparent hover:border-line')}>
        {listening ? t('sc.press') : <Kbd>{formatCombo(bindingOf(id, keys))}</Kbd>}
      </button>
      {changed && !listening && <button title={t('sc.reset')} onClick={() => setKey(id, null)} className="grid size-5 place-items-center rounded text-muted transition-colors hover:bg-accent-bg hover:text-accent"><MdRestartAlt size={14} /></button>}
    </div>
  )
}

/** Los atajos de teclado como una pestaña más del editor: una tabla con el apartado, la acción y las teclas; algunos se pueden cambiar. */
export function ShortcutsView() {
  const t = useT()
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b border-line text-[11px] font-medium text-muted">
            <th className="w-40 px-3 py-1.5 font-medium">{t('sc.col.section')}</th>
            <th className="px-3 py-1.5 font-medium">{t('sc.col.action')}</th>
            <th className="w-72 px-3 py-1.5 font-medium">{t('sc.col.keys')}</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.flatMap((section) => section.items.map(([fixed, what, id], i) => (
            <tr key={`${section.title}-${what}-${id ?? fixed}`} className="border-b border-line/50 font-light transition-colors hover:bg-ov/[0.04]">
              <td className="px-3 py-1.5 text-muted">{i === 0 ? t(section.title) : ''}</td>
              <td className="px-3 py-1.5">{t(what)}</td>
              <td className="px-3 py-1">{id ? <KeyCell id={id} /> : <Kbd>{fixed.startsWith('key.') ? t(fixed as MsgKey) : fixed}</Kbd>}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  )
}
