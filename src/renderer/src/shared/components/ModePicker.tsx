import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MdCheck, MdCode, MdOutlineBolt, MdOutlineChecklist, MdOutlineExplore, MdPanTool } from 'react-icons/md'
import type { ReactNode } from 'react'
import { useT } from '@/renderer/src/shared/lib/i18n'

/** Los modos de permisos del SDK: pedir aprobación, editar solo, planear primero, o aprobar lo seguro. */
export type ChatMode = 'manual' | 'edit' | 'plan' | 'explorer' | 'auto'
export const MODES: Array<{ id: ChatMode; icon: ReactNode }> = [
  { id: 'manual', icon: <MdPanTool size={16} /> },
  { id: 'edit', icon: <MdCode size={16} /> },
  { id: 'plan', icon: <MdOutlineChecklist size={16} /> },
  { id: 'explorer', icon: <MdOutlineExplore size={16} /> },
  { id: 'auto', icon: <MdOutlineBolt size={16} /> }
]

/** Lista de modos encima de la caja de escritura (`anchor` = su rectángulo en pantalla). */
export function ModePicker({ anchor, mode, onMode, onClose }: { anchor: DOMRect; mode: ChatMode; onMode: (mode: ChatMode) => void; onClose: () => void }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const down = (e: PointerEvent): void => { if (!box.current?.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true) }
  }, [onClose])

  return createPortal(
    <div ref={box} style={{ left: anchor.left, width: anchor.width, bottom: window.innerHeight - anchor.top + 4 }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
      <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-2 text-[11px] text-muted">
        <span>{t('chat.modes')}</span>
        <span className="flex items-center gap-1"><kbd className="rounded bg-line/60 px-1">⇧</kbd>+<kbd className="rounded bg-line/60 px-1">tab</kbd>{t('chat.mode.switch')}</span>
      </div>
      <div className="px-1 pb-1">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => { onMode(m.id); onClose() }}
            className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent-bg ${m.id === mode ? 'bg-accent-bg' : ''}`}>
            <span className="shrink-0 text-muted">{m.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-text">{t(`chat.mode.${m.id}` as never)}</span>
              <span className="block text-[10.5px] leading-snug text-muted">{t(`chat.mode.${m.id}D` as never)}</span>
            </span>
            {m.id === mode && <MdCheck size={15} className="shrink-0 text-accent" />}
          </button>
        ))}
      </div>
    </div>, document.body
  )
}
