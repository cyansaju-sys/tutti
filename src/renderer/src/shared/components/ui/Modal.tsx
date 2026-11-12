import { useEffect, type ReactNode } from 'react'
import { MdClose } from 'react-icons/md'
import { useT } from '@/shared/lib/i18n'

/** Diálogo modal centrado arriba, se cierra con Esc o al pulsar fuera. */
/** `top`: se ancla arriba y al centro (como los selectores rápidos), en vez de centrarse en vertical. */
export function Modal({ onClose, children, width = 520, title, top }: { onClose: () => void; children: ReactNode; width?: number; title?: string; top?: boolean }) {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !document.querySelector('[role="menu"]')) { e.stopPropagation(); onClose() } }          // con un menú abierto encima, Esc es suyo
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return (
    <div className={`fixed inset-0 z-50 flex animate-fade-in justify-center bg-black/12 backdrop-blur-[1px] ${top ? 'items-start pt-[9vh]' : 'items-center'}`} onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width }}
        className="max-h-[78vh] animate-pop-in overflow-hidden rounded-xl border border-ov/[0.06] bg-pop shadow-[0_18px_50px_-18px_rgba(0,0,0,0.75)]"
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="text-[13px] font-medium tracking-[0.01em] text-text">{title}</h2>
            <button onClick={onClose} title={t('title.close')} className="-mr-1.5 grid size-6 place-items-center rounded-md text-muted/70 transition-colors hover:bg-ov/[0.06] hover:text-text"><MdClose size={14} /></button>
          </div>
        )}
        {title ? <div className="pt-3.5">{children}</div> : children}
      </div>
    </div>
  )
}
