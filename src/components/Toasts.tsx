import { MdCheckCircle, MdClose, MdErrorOutline, MdInfoOutline } from 'react-icons/md'
import { useStore } from '@/store'

const ICON = {
  ok: <MdCheckCircle size={17} className="text-ok" />,
  error: <MdErrorOutline size={17} className="text-danger" />,
  info: <MdInfoOutline size={17} className="text-accent" />
}

/** Avisos breves abajo a la derecha, sobre el pie, al estilo de las notificaciones de un IDE: icono, mensaje y una X; se cierran solos o al pulsarlos. */
export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-8 right-3 z-[60] flex flex-col items-end gap-1.5">
      {toasts.map((t) => (
        <div key={t.id} onClick={() => dismiss(t.id)}
          className="pointer-events-auto flex w-[360px] max-w-[calc(100vw-24px)] animate-toast-in cursor-pointer items-start gap-2.5 rounded-md border border-line bg-raised/75 backdrop-blur-md px-3 py-2.5 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)]">
          <span className="mt-px shrink-0">{ICON[t.kind]}</span>
          <span className="line-clamp-4 min-w-0 flex-1 text-[12px] leading-snug text-text">{t.message}</span>
          <button onClick={(e) => { e.stopPropagation(); dismiss(t.id) }} className="grid size-5 shrink-0 place-items-center rounded text-muted transition-colors hover:bg-line hover:text-text"><MdClose size={14} /></button>
        </div>
      ))}
    </div>
  )
}
