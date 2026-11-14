import { useRef, type KeyboardEvent } from 'react'
import { useConfirm } from '@/renderer/src/shared/lib/confirm'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { Modal } from '@/renderer/src/shared/components/ui'

/** La pregunta de sí o no de `confirmAsk`. Se enfoca «Cancelar»: lo que se pregunta descarta algo, y Enter o Espacio por descuido no deben confirmarlo. ← → pasan de un botón a otro. */
export function ConfirmDialog() {
  const t = useT()
  const ask = useConfirm((s) => s.ask)
  const buttons = useRef<HTMLDivElement>(null)
  if (!ask) return null
  const move = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault(); e.stopPropagation()
    const [cancel, accept] = Array.from(buttons.current?.querySelectorAll('button') ?? [])
    ;(e.key === 'ArrowLeft' ? cancel : accept)?.focus()
  }
  return (
    <Modal onClose={() => ask.resolve(false)} width={400}>
      <div className="flex flex-col gap-4 px-5 pb-4 pt-5">
        <p className="selectable whitespace-pre-line text-[13px] leading-snug">{ask.message}</p>
        <div ref={buttons} onKeyDown={move} className="flex justify-end gap-2">
          <button autoFocus onClick={() => ask.resolve(false)} className="rounded-lg px-3.5 py-1.5 text-[12px] text-muted outline-none transition-colors hover:bg-ov/[0.06] focus-visible:bg-ov/[0.08] focus-visible:text-text focus-visible:ring-1 focus-visible:ring-accent/60">{t('dlg.cancel')}</button>
          <button onClick={() => ask.resolve(true)} className="rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-medium text-bg outline-none transition-[filter] hover:brightness-110 focus-visible:brightness-110 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-pop">{ask.ok ?? t('dlg.accept')}</button>
        </div>
      </div>
    </Modal>
  )
}
