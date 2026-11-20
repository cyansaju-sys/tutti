import { useState } from 'react'
import { MdClose } from 'react-icons/md'

/** Una imagen adjunta como etiqueta: miniatura, nombre y tamaño en píxeles (con X para quitarla cuando aún no se ha enviado). */
export function ImageChip({ src, onRemove, removeTitle }: { src: string; onRemove?: () => void; removeTitle?: string }) {
  const [size, setSize] = useState('')
  const ext = /^data:image\/(\w+)/.exec(src)?.[1]?.replace('jpeg', 'jpg') ?? 'png'
  return (
    <span className="group flex items-center gap-1.5 rounded-md border border-ov/[0.08] bg-ov/[0.05] py-1 pl-1.5 pr-2 text-[11px] text-text">
      <img src={src} alt="" onLoad={(e) => setSize(`${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`)} className="size-4 shrink-0 rounded-[3px] border border-line object-cover" />
      <span className="font-light">{`image.${ext}`}</span>
      {size && <span className="text-[10px] text-muted/80">{size}</span>}
      {onRemove && <button title={removeTitle} onClick={onRemove} className="no-drag -mr-1 ml-0.5 grid size-4 place-items-center rounded text-muted transition-colors hover:bg-ov/10 hover:text-text"><MdClose size={11} /></button>}
    </span>
  )
}
