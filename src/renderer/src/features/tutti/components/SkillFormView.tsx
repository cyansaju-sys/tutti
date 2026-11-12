import { useMemo } from 'react'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { skillsProps } from '@/models/skills/skillsProps'
import { slug } from '../lib/spec'
import { useAskAgent } from '../lib/useAskAgent'
import { useFormValues } from '../lib/useFormValues'
import { AgentSelect } from './AgentSelect'
import { FieldsFormView } from './FieldsFormView'
import { buildSkillFile, skillAgentPrompt, skillFormError, type SkillForm } from '../lib/skillForm'

/** Crear una skill como una pestaña del editor: nombre, cuándo usarla y las instrucciones (o pedirle al agente que las redacte). */
export function SkillFormView() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const closeDoc = useStore((s) => s.closeDoc)
  const ask = useAskAgent()
  const agent = ask.selected
  const fields = useMemo(() => skillsProps({ hasAgent: !!agent, agentSelect: <AgentSelect options={ask.options} value={agent} onChange={ask.setPicked} /> }), [agent, ask.options, ask.setPicked])
  const { values, set } = useFormValues(fields)

  /** Importa una skill que ya tienes: se elige su carpeta (con su SKILL.md) y se copia a .tutti/skills. */
  const importExisting = async (): Promise<void> => {
    if (!project) return
    const source = await window.api.dialog.chooseFolder(project)
    if (!source) return
    const res = await window.api.skills.import(project, source)
    if (!res.ok) { toast(res.message, 'error'); return }
    closeDoc('skill:new')
    void openDoc(res.message)
  }

  const create = async (v: Record<string, string>): Promise<void> => {
    if (!project) return
    const form: SkillForm = { name: v.name, description: v.description, instructions: v.instructions, useAgent: !!v.useAgent && !!agent }
    const dir = await window.api.context.init(project, 'skills')
    const folder = slug(form.name) || 'skill'
    const made = await window.api.fs.create(dir, folder, true)
    if (!made.ok) { toast(made.message, 'error'); return }
    const file = `${made.message}/SKILL.md`
    await window.api.fs.write(file, buildSkillFile(lang, form), false)
    if (form.useAgent) await ask.send(skillAgentPrompt(lang, form, `.tutti/skills/${folder}`))
    closeDoc('skill:new')
    void openDoc(file)
  }

  return (
    <FieldsFormView title={t('skf.title')} subtitle={t('skf.subtitle')} fields={fields} values={values} onChange={set} submitLabel={t('skf.create')}
      validate={(v) => { const e = skillFormError({ name: v.name, description: v.description, instructions: v.instructions, useAgent: false }); return e ? [e] : [] }}
      onSubmit={create} onCancel={() => closeDoc('skill:new')}
      before={(
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
          <span className="text-[11px] leading-snug text-muted">{t('skf.importHint')}</span>
          <button onClick={() => void importExisting()} className="shrink-0 rounded-lg border border-line px-3 py-1 text-[12px] transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent">{t('skf.import')}</button>
        </div>
      )} />
  )
}
