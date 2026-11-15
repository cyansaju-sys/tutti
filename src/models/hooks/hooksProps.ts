import type { FormField } from '@/features/tutti/lib/formFields'
import { EMPTY_HOOK_FORM, HOOK_TRIGGERS } from '@/features/tutti/lib/spec'

/** Los campos del formulario de un hook (nombre, evento, filtro de archivos y qué hacer: un comando o pedirle algo al agente). */
export const hooksProps = (): FormField[] => [
  { name: 'name', label: 'hf.name', value: EMPTY_HOOK_FORM.name, inputProps: { placeholder: 'hf.namePh', spellCheck: false }, positionGrid: { x: 1, y: 1 } },
  { name: 'description', label: 'hf.description', value: EMPTY_HOOK_FORM.description, inputProps: { spellCheck: false }, positionGrid: { x: 1, y: 2 } },
  {
    name: 'trigger', label: 'hf.trigger', kind: 'select', value: EMPTY_HOOK_FORM.trigger, positionGrid: { x: 1, y: 3 },
    options: HOOK_TRIGGERS.map((x) => ({ value: x.id, label: x.id, detailKey: `hf.t.${x.id}` as const })),
    hint: (v, { t }) => (HOOK_TRIGGERS.find((x) => x.id === v.trigger)?.runs === false ? { text: t('tutti.hookNoRun'), tone: 'warn' } : null)
  },
  {
    name: 'matcher', label: 'hf.matcher', value: EMPTY_HOOK_FORM.matcher, example: '\\.(ts|tsx)$', inputProps: { className: 'font-mono', spellCheck: false }, positionGrid: { x: 1, y: 4 },
    hint: (_v, { t, error }) => (error ? { text: t('hf.matcherBad'), tone: 'danger' } : { text: t('hf.matcherHint') })
  },
  {
    name: 'action', label: 'hf.action', kind: 'radio', value: EMPTY_HOOK_FORM.action, positionGrid: { x: 1, y: 5 },
    options: [{ value: 'agent', labelKey: 'hf.a.agent' }, { value: 'command', labelKey: 'hf.a.command' }]
  },
  { name: 'prompt', label: 'hf.prompt', kind: 'textarea', value: EMPTY_HOOK_FORM.prompt, inputProps: { rows: 4, placeholder: 'hf.promptPh', spellCheck: false }, positionGrid: { x: 1, y: 6 }, visible: (v) => v.action === 'agent' },
  {
    name: 'command', label: 'hf.command', value: EMPTY_HOOK_FORM.command, example: 'npx eslint --fix $TUTTI_HOOK_FILE', inputProps: { className: 'font-mono', spellCheck: false }, positionGrid: { x: 1, y: 6 }, visible: (v) => v.action === 'command',
    hint: (_v, { t }) => ({ text: t('hf.commandHint') })
  },
  { name: 'timeout', label: 'hf.timeout', value: EMPTY_HOOK_FORM.timeout, inputProps: { inputMode: 'numeric', className: 'w-24', spellCheck: false }, positionGrid: { x: 1, y: 7 }, visible: (v) => v.action === 'command' }
]
