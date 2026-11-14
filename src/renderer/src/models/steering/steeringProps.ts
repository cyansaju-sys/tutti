import type { FormField } from '@/renderer/src/features/tutti/lib/formFields'
import { slug } from '@/renderer/src/features/tutti/lib/spec'
import { EMPTY_STEERING_FORM, INCLUSIONS } from '@/renderer/src/features/tutti/lib/steeringForm'

/** Los campos del formulario de un steering: nombre, ámbito (proyecto o global), cuándo se entrega y, según eso, los patrones o la descripción. */
export const steeringProps = (): FormField[] => [
  {
    name: 'name', label: 'stf.name', value: EMPTY_STEERING_FORM.name, inputProps: { placeholder: 'stf.namePh', spellCheck: false }, positionGrid: { x: 1, y: 1 },
    hint: (v) => ({ text: `${v.scope === 'global' ? '…/tutti/steering/' : '.tutti/steering/'}${slug(v.name ?? '') || '…'}.md` })
  },
  {
    name: 'scope', label: 'stf.scope', kind: 'radio', value: EMPTY_STEERING_FORM.scope, positionGrid: { x: 1, y: 2 },
    options: [{ value: 'project', labelKey: 'stf.s.project' }, { value: 'global', labelKey: 'stf.s.global' }],
    hint: (v, { t }) => ({ text: t(`stf.sh.${v.scope === 'global' ? 'global' : 'project'}` as const) })
  },
  {
    name: 'inclusion', label: 'stf.when', kind: 'radio', value: EMPTY_STEERING_FORM.inclusion, positionGrid: { x: 1, y: 3 },
    options: INCLUSIONS.map((m) => ({ value: m, labelKey: `stf.m.${m}` as const })),
    hint: (v, { t }) => ({ text: t(`stf.h.${v.inclusion}` as 'stf.h.always') })
  },
  {
    name: 'patterns', label: 'stf.patterns', value: EMPTY_STEERING_FORM.patterns, example: 'src/components/**/*.tsx, **/*.ts', inputProps: { className: 'font-mono', spellCheck: false }, positionGrid: { x: 1, y: 4 },
    visible: (v) => v.inclusion === 'fileMatch',
    hint: (_v, { t, error }) => (error ? { text: t('stf.patternsNeed'), tone: 'danger' } : { text: t('stf.patternsHint') })
  },
  {
    name: 'description', label: 'stf.description', kind: 'textarea', value: EMPTY_STEERING_FORM.description, inputProps: { rows: 2, placeholder: 'stf.descriptionPh', spellCheck: false }, positionGrid: { x: 1, y: 4 },
    visible: (v) => v.inclusion === 'auto'
  }
]
