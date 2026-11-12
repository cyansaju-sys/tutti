import { clsx } from 'clsx'
import { useState } from 'react'
import { MdExpandMore } from 'react-icons/md'
import { Menu } from '@/shared/components/Menu'
import { FIELD } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { splitDeps } from '../lib/roleGraph'
import type { FieldOption, FormField, Values } from '../lib/formFields'

interface Props {
  title: string
  subtitle?: string
  fields: FormField[]
  values: Values
  onChange: (patch: Values) => void
  submitLabel: string
  /** Qué campos fallan (por nombre); se marcan al intentar enviar. Los `required` vacíos fallan siempre. */
  validate?: (values: Values) => string[]
  onSubmit: (values: Values) => void | Promise<void>
  onCancel: () => void
  /** Contenido antes de los campos, nota antes de los botones y contenido después de ellos. */
  before?: React.ReactNode
  note?: string
  after?: React.ReactNode
}

const TONE = { warn: 'text-warn', danger: 'text-danger' } as const

/** Un desplegable (menú anclado al campo) para los campos `select`. */
function SelectField({ field, options, value, onPick, className }: { field: FormField; options: FieldOption[]; value: string; onPick: (v: string) => void; className: string }) {
  const t = useT()
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const text = (o: FieldOption): string => o.label ?? (o.labelKey ? t(o.labelKey) : o.value)
  const current = options.find((o) => o.value === value)
  return (
    <>
      <button type="button" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())} aria-haspopup="menu" aria-expanded={!!menu}
        className={clsx(className, 'flex cursor-pointer items-center gap-2 text-left transition-colors hover:bg-ov/[0.07]', menu && 'bg-ov/[0.07]')}>
        <span className="font-medium">{current ? text(current) : value}</span>
        {current?.detailKey && <span className="min-w-0 flex-1 truncate text-muted">{t(current.detailKey)}</span>}
        <MdExpandMore size={16} className={clsx('ml-auto shrink-0 text-muted transition-transform', menu && 'rotate-180')} />
      </button>
      {menu && (
        <Menu anchor={menu} width={Math.max(300, menu.width)} onClose={() => setMenu(null)}
          items={options.map((o) => ({ label: text(o), detail: o.detailKey && t(o.detailKey), checked: o.value === value, onClick: () => onPick(o.value) }))} />
      )}
    </>
  )
}

/**
 * Formulario de una pestaña del editor definido por una lista de campos (`FormField`): los coloca en una cuadrícula, valida al enviar
 * (botón o Enter) y llama a `onSubmit` con los valores. Los valores los lleva quien lo usa (`useFormValues`).
 */
export function FieldsFormView({ title, subtitle, fields, values, onChange, submitLabel, validate, onSubmit, onCancel, before, note, after }: Props) {
  const t = useT()
  const [tried, setTried] = useState(false)
  const shown = fields.filter((f) => !f.visible || f.visible(values))
  const failing = (): Set<string> => new Set([...(validate?.(values) ?? []), ...shown.filter((f) => f.inputProps?.required && !values[f.name]?.trim()).map((f) => f.name)])
  const bad = tried ? failing() : new Set<string>()
  const submit = (): void => {
    setTried(true)
    if (failing().size) return
    void onSubmit(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])))
  }
  const cols = Math.max(1, ...shown.map((f) => f.positionGrid.x))
  const alone = (f: FormField): boolean => shown.filter((o) => o.positionGrid.y === f.positionGrid.y).length === 1          // un campo solo en su fila ocupa todo el ancho
  const text = (f: FormField): boolean => !f.kind || f.kind === 'input' || f.kind === 'textarea'
  const first = shown.filter(text).sort((a, b) => a.positionGrid.y - b.positionGrid.y || a.positionGrid.x - b.positionGrid.x)[0]

  const optionsOf = (f: FormField): FieldOption[] => (typeof f.options === 'function' ? f.options(values) : f.options ?? [])
  const control = (f: FormField): React.ReactNode => {
    const { placeholder, className, ...rest } = f.inputProps ?? {}
    const off = !!f.disabled?.(values)
    const value = values[f.name] ?? ''
    const ring = bad.has(f.name) ? 'ring-1 ring-danger/70' : ''
    if (f.kind === 'custom') return f.render?.(values, onChange)
    if (f.kind === 'radio') {
      return (
        <div className={clsx('flex gap-1 rounded-lg border border-line p-0.5', ring)} role="radiogroup" aria-label={f.label && t(f.label)}>
          {optionsOf(f).map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={off} onClick={() => onChange({ [f.name]: o.value })}
              className={clsx('flex-1 rounded-md px-2 py-1 text-[12px] transition-colors', value === o.value ? 'bg-accent-bg font-medium text-accent' : 'text-muted hover:text-text')}>{o.label ?? (o.labelKey ? t(o.labelKey) : o.value)}</button>
          ))}
        </div>
      )
    }
    if (f.kind === 'multiselect') {
      const chosen = splitDeps(value)
      const toggle = (v: string): void => onChange({ [f.name]: (chosen.includes(v) ? chosen.filter((c) => c !== v) : [...chosen, v]).join(', ') })
      return (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={f.label && t(f.label)}>
          {optionsOf(f).map((o) => (
            <button key={o.value} type="button" aria-pressed={chosen.includes(o.value)} disabled={off} onClick={() => toggle(o.value)}
              className={clsx('rounded-full border px-2.5 py-0.5 text-[12px] transition-colors', chosen.includes(o.value) ? 'border-accent bg-accent-bg font-medium text-accent' : 'border-line text-muted hover:border-accent hover:text-text')}>{o.label ?? (o.labelKey ? t(o.labelKey) : o.value)}</button>
          ))}
        </div>
      )
    }
    if (f.kind === 'select') return <SelectField field={f} options={optionsOf(f)} value={value} onPick={(v) => onChange({ [f.name]: v })} className={clsx(FIELD, ring)} />
    if (f.kind === 'checkbox') {
      return (
        <label className={clsx('flex items-center gap-2 text-[12px]', off && 'opacity-50')}>
          <input type="checkbox" checked={value === 'true'} disabled={off} onChange={(e) => onChange({ [f.name]: e.target.checked ? 'true' : '' })} className="accent-[var(--color-accent)]" />
          {f.label && t(f.label)}
        </label>
      )
    }
    const common = {
      ...rest, name: f.name, value, disabled: off, placeholder: f.example ?? (placeholder && t(placeholder)), autoFocus: f === first,
      onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange({ [f.name]: e.target.value }),
      className: clsx(FIELD, className, ring, off && 'opacity-50')
    }
    return f.kind === 'textarea'
      ? <textarea {...common} rows={rest.rows ?? 3} className={clsx(common.className, 'resize-none')} />
      : <input {...common} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
  }

  return (
    <div className="selectable min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <h2 className="m-0 text-[17px] font-semibold">{title}</h2>
        {subtitle && <p className="mb-2 mt-1 text-[12px] leading-snug text-muted">{subtitle}</p>}
        {before}
        <div className="mt-4 grid gap-x-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {shown.map((f) => {
            const hint = f.hint?.(values, { t, error: bad.has(f.name) })
            return (
              <div key={f.name} style={{ gridColumn: alone(f) ? '1 / -1' : f.positionGrid.x, gridRow: f.positionGrid.y }} className="mb-3 min-w-0">
                {f.label && f.kind !== 'checkbox' && <label className="mb-1 block text-[11px] font-medium text-muted">{t(f.label)}</label>}
                {control(f)}
                {hint && <p className={clsx('mt-1 text-[10px] leading-snug', hint.tone ? TONE[hint.tone] : 'text-muted')}>{hint.text}</p>}
              </div>
            )
          })}
        </div>
        {note && <p className="mb-3 text-[10px] leading-snug text-muted">{note}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button onClick={submit} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{submitLabel}</button>
        </div>
        {after}
      </div>
    </div>
  )
}
