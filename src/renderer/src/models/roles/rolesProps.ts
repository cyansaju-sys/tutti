import type { FormField } from '@/features/tutti/lib/formFields'
import { slug } from '@/features/tutti/lib/spec'

/** Los modelos de Claude que se pueden pedir para un rol (el id es el que entiende el agente). */
export const MODELS = [
  { value: 'claude-fable-5-2', label: 'Fable 5.2' },
  { value: 'claude-opus-5-5', label: 'Opus 5.5' },
  { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { value: 'claude-haiku-5-5', label: 'Haiku 5.5' }
]

/** Los campos del formulario de un rol (en una columna). `agents`: los agentes disponibles; `models`: los modelos de cada agente (por su comando); `root`: la carpeta de Tutti del proyecto (`.tutti` o `.agents`); `roles`: los roles que ya existen (de los que puede depender). */
export const rolesProps = ({ agents = [], roles = [], root = '.tutti', models = {} }: { agents?: Array<{ command: string; name: string }>; roles?: string[]; root?: string; models?: Record<string, string[]> } = {}): FormField[] => [
  {
    name: 'name', label: 'rf.name', value: '', inputProps: { placeholder: 'rf.namePh', required: true, spellCheck: false }, positionGrid: { x: 1, y: 1 }
  },
  { name: 'specialty', label: 'rf.specialty', value: '', inputProps: { placeholder: 'rf.specialtyPh', spellCheck: false }, positionGrid: { x: 1, y: 2 } },
  {
    name: 'difficulty', label: 'rf.difficulty', kind: 'radio', value: 'medium', positionGrid: { x: 1, y: 5 },
    options: [{ value: 'low', labelKey: 'rf.d.low' }, { value: 'medium', labelKey: 'rf.d.medium' }, { value: 'high', labelKey: 'rf.d.high' }]
  },
  { name: 'agent', label: 'rf.agent', kind: 'select', value: '', positionGrid: { x: 1, y: 6 }, options: [{ value: '', labelKey: 'rf.agentAny' }, ...agents.map((a) => ({ value: a.command, label: a.name }))] },
  { name: 'model', label: 'rf.model', kind: 'select', value: '', positionGrid: { x: 2, y: 6 }, options: (v) => [{ value: '', labelKey: 'rf.modelDefault' }, ...(v.agent ? (models[v.agent] ?? []).map((id) => ({ value: id, label: id })) : MODELS)] },
  {
    name: 'dependsOn', label: 'rf.dependsOn', kind: 'multiselect', value: '', positionGrid: { x: 1, y: 7 }, options: roles.map((r) => ({ value: r, label: r })),
    hint: (_v, { t }) => (roles.length ? null : { text: t('rf.dependsEmpty') })
  },
  { name: 'deliverable', label: 'rf.deliverable', value: '', inputProps: { placeholder: 'rf.deliverablePh', spellCheck: false }, positionGrid: { x: 1, y: 3 } },
  { name: 'description', label: 'rf.description', kind: 'textarea', value: '', inputProps: { rows: 4, placeholder: 'rf.descriptionPh', spellCheck: false }, positionGrid: { x: 1, y: 4 } }
]
