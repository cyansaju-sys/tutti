import type { ReactNode } from 'react'
import type { FormField } from '@/renderer/src/features/tutti/lib/formFields'
import { EMPTY_SKILL_FORM } from '@/renderer/src/features/tutti/lib/skillForm'
import { slug } from '@/renderer/src/features/tutti/lib/spec'

/** Los campos del formulario de una skill. `hasAgent`: hay un agente para redactarla; `agentSelect`: el selector del agente (se ve con la casilla marcada). */
export const skillsProps = ({ hasAgent, agentSelect }: { hasAgent: boolean; agentSelect: ReactNode }): FormField[] => [
  {
    name: 'name', label: 'skf.name', value: EMPTY_SKILL_FORM.name, inputProps: { placeholder: 'skf.namePh', spellCheck: false }, positionGrid: { x: 1, y: 1 },
    hint: (v) => ({ text: `.tutti/skills/${slug(v.name ?? '') || '…'}/SKILL.md` })
  },
  {
    name: 'description', label: 'skf.description', kind: 'textarea', value: EMPTY_SKILL_FORM.description, inputProps: { rows: 3, placeholder: 'skf.descriptionPh', spellCheck: false }, positionGrid: { x: 1, y: 2 },
    hint: (_v, { t, error }) => (error ? { text: t('skf.descriptionNeed'), tone: 'danger' } : { text: t('skf.descriptionHint') })
  },
  {
    name: 'instructions', label: 'skf.instructions', kind: 'textarea', value: EMPTY_SKILL_FORM.instructions, inputProps: { rows: 6, placeholder: 'skf.instructionsPh', className: 'font-mono', spellCheck: false }, positionGrid: { x: 1, y: 3 },
    disabled: (v) => !!v.useAgent && hasAgent,
    hint: (_v, { t }) => ({ text: t('skf.instructionsHint') })
  },
  { name: 'useAgent', label: hasAgent ? 'skf.agent' : 'skf.noAgent', kind: 'checkbox', value: '', positionGrid: { x: 1, y: 4 }, disabled: () => !hasAgent },
  { name: 'agent', kind: 'custom', positionGrid: { x: 1, y: 5 }, visible: (v) => !!v.useAgent && hasAgent, render: () => agentSelect }
]
