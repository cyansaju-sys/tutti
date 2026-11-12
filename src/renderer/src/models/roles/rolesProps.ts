import type { FormField } from '@/features/tutti/lib/formFields'
import { slug } from '@/features/tutti/lib/spec'

/** Los campos del formulario de un rol. */
export const rolesProps = (): FormField[] => [
  { name: 'name', label: 'rf.name', value: '', inputProps: { placeholder: 'rf.namePh', required: true, spellCheck: false }, positionGrid: { x: 1, y: 1 },
    hint: (v) => ({ text: `.tutti/roles/${slug(v.name ?? '') || '…'}.md` }) }
]
