import { useCallback, useState } from 'react'
import type { FormField, Values } from './formFields'

/** Los valores de un formulario de campos: parten de `value` de cada campo; `set` cambia algunos y `reset` los reemplaza (p. ej. al cargar lo que se edita). */
export function useFormValues(fields: FormField[]): { values: Values; set: (patch: Values) => void; reset: (values: Values) => void } {
  const [values, setValues] = useState<Values>(() => Object.fromEntries(fields.map((f) => [f.name, f.value ?? ''])))
  const set = useCallback((patch: Values): void => setValues((v) => ({ ...v, ...patch })), [])
  return { values, set, reset: setValues }
}
