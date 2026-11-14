import { clsx } from 'clsx'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MdUnfoldMore } from 'react-icons/md'
import { Menu } from '@/renderer/src/shared/components/Menu'
import { FIELD } from './fields'

/** Lista desplegable con el aspecto de la app (el `<select>` del sistema no sigue el tema): un campo que abre un menú con la opción elegida marcada. */
export function Select({ value, options, onChange, disabled, title }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; disabled?: boolean; title?: string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const current = options.find((o) => o.value === value)
  return (
    <>
      <button type="button" disabled={disabled} title={title} aria-haspopup="listbox" onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
        className={clsx(FIELD, 'flex items-center justify-between gap-2 text-left', disabled ? 'cursor-default opacity-50' : 'hover:bg-ov/[0.07]')}>
        <span className="truncate">{current?.label ?? value}</span>
        <MdUnfoldMore size={15} className="shrink-0 text-muted" />
      </button>
      {/* en el body, no dentro del campo: dentro de un <label>, el clic en una opción le llegaba al botón y volvía a abrir la lista */}
      {anchor && createPortal(<Menu anchor={anchor} width={Math.max(anchor.width, 160)} scroll onClose={() => setAnchor(null)} items={options.map((o) => ({ label: o.label, checked: o.value === value, onClick: () => onChange(o.value) }))} />, document.body)}
    </>
  )
}
