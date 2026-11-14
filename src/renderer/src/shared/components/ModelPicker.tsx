import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MdCheck } from 'react-icons/md'
import { useT } from '@/renderer/src/shared/lib/i18n'
import type { ChatEffort, ChatModel } from '@/shared/types'

export const EFFORTS: ChatEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']
export const effortLabel = (e: ChatEffort): string => (e === 'xhigh' ? 'XHigh' : e[0].toUpperCase() + e.slice(1))

/** Selector de modelo y esfuerzo: una lista encima de la caja de escritura (`anchor` = su rectángulo en pantalla). */
export function ModelPicker({ anchor, models, model, effort, onModel, onEffort, onClose }: {
  anchor: DOMRect; models: ChatModel[] | null; model: string; effort: ChatEffort
  onModel: (value: string) => void; onEffort: (effort: ChatEffort) => void; onClose: () => void
}) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const current = models?.find((m) => m.value === model)
  const levels = current?.efforts?.length ? current.efforts : EFFORTS      // la fila del esfuerzo siempre está, fija debajo de la lista

  useEffect(() => {
    const down = (e: PointerEvent): void => { if (!box.current?.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true) }
  }, [onClose])

  return createPortal(
    <div ref={box} style={{ left: anchor.left, width: anchor.width, bottom: window.innerHeight - anchor.top + 4, maxHeight: Math.min(300, Math.max(160, anchor.top - 14)) }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
      <div className="shrink-0 px-3 pb-1 pt-2 text-[11px] text-muted">{t('chat.selectModel')}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
        {models ? models.map((m) => (
          <button key={m.value} onClick={() => { onModel(m.value); onClose() }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent-bg ${m.value === model ? 'bg-accent-bg' : ''}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-text">{m.displayName}</span>
              <span className="block truncate text-[10.5px] text-muted">{m.description}</span>
            </span>
            {m.value === model && <MdCheck size={15} className="shrink-0 text-accent" />}
          </button>
        )) : <div className="px-2 py-1.5 text-[12px] text-muted">{t('chat.loadingModels')}</div>}
      </div>
      {levels.length > 0 && (
        <div className="flex shrink-0 items-center justify-between border-t border-line px-3 py-2">
          <span className="text-[12px] text-text">{t('chat.effort')} <span className="text-muted">({effortLabel(effort)})</span></span>
          <div className="flex items-center gap-0.5 rounded-full bg-line/40 px-1">
            {levels.map((l) => (
              <button key={l} title={effortLabel(l)} onClick={() => onEffort(l)} className="grid size-4 place-items-center">
                <span className={`block rounded-full transition-all ${l === effort ? 'size-3 bg-accent' : 'size-1.5 bg-muted/60'}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>, document.body
  )
}
