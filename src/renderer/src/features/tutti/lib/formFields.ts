import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import type { MsgKey } from '@shared/i18n'
import type { T } from '@/shared/lib/i18n'

export type Values = Record<string, string>

/** Una opción de un campo `radio` o `select`: `labelKey` (i18n) o `label` (texto tal cual), y un `detailKey` opcional (texto tenue). */
export interface FieldOption { value: string; labelKey?: MsgKey; label?: string; detailKey?: MsgKey }

/** El texto bajo un campo: `tone` lo colorea (por defecto, tenue). */
export interface FieldHint { text: string; tone?: 'warn' | 'danger' }

/**
 * Un campo de un formulario de pestaña (ver `FieldsFormView`).
 * - `label` y `inputProps.placeholder` son claves de i18n.
 * - `value` es el valor inicial; todos los valores son texto (un `checkbox` guarda 'true' o '').
 * - `kind`: `input` (por defecto), `textarea`, `radio`, `select` (con `options`), `multiselect` (varias a la vez; el valor es «a, b»), `checkbox` o `custom` (con `render`).
 * - `inputProps`: lo que se pasa al `<input>`/`<textarea>` (`required` lo hace obligatorio).
 * - `positionGrid`: celda de la cuadrícula (x = columna, y = fila, desde 1); los campos de una misma fila se reparten el ancho.
 * - `visible` / `disabled`: según los valores actuales. `hint`: el texto bajo el campo (`error`: el campo falló al validar).
 */
export interface FormField {
  name: string
  label?: MsgKey
  value?: string
  example?: string          // texto de ejemplo tal cual (sin traducir) para el placeholder
  kind?: 'input' | 'textarea' | 'radio' | 'select' | 'multiselect' | 'checkbox' | 'custom'
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>, 'placeholder' | 'value' | 'disabled'> & { placeholder?: MsgKey }
  options?: FieldOption[] | ((values: Values) => FieldOption[])          // con una función, las opciones dependen de otros campos
  positionGrid: { x: number; y: number }
  visible?: (values: Values) => boolean
  disabled?: (values: Values) => boolean
  hint?: (values: Values, ctx: { t: T; error: boolean }) => FieldHint | null
  render?: (values: Values, set: (patch: Values) => void) => ReactNode
}
