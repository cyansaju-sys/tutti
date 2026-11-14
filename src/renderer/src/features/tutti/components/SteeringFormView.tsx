import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import { steeringProps } from '@/renderer/src/models/steering/steeringProps'
import { slug } from '@/renderer/src/features/tutti/lib/spec'
import { useAskAgent } from '@/renderer/src/features/tutti/lib/useAskAgent'
import { useFormValues } from '@/renderer/src/features/tutti/lib/useFormValues'
import { AgentSelect } from './AgentSelect'
import { FieldsFormView } from './FieldsFormView'
import { buildSteeringFile, FOUNDATION, foundationFiles, foundationPrompt, steeringFormError, type SteeringForm } from '@/renderer/src/features/tutti/lib/steeringForm'

/**
 * Crear un steering como una pestaña del editor, con los modos de Kiro (siempre, por archivos, manual, automático), o crear de golpe los tres
 * archivos base (producto, tecnología y estructura) y pedirle al agente que los rellene explorando el proyecto.
 */
export function SteeringFormView() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const closeDoc = useStore((s) => s.closeDoc)
  const [askAgent, setAskAgent] = useState(true)
  const fields = useMemo(steeringProps, [])
  const { values, set } = useFormValues(fields)
  const ask = useAskAgent()
  const agent = ask.selected

  const create = async (v: Record<string, string>): Promise<void> => {
    const form = v as unknown as SteeringForm
    if (!project) return
    const dir = form.scope === 'global' ? await window.api.context.globalSteeringDir() : await window.api.context.init(project, 'steering')       // el global vive en la configuración de Tutti, fuera de los repositorios
    const made = await window.api.fs.create(dir, `${slug(form.name) || 'steering'}.md`, false)
    if (!made.ok) { toast(made.message, 'error'); return }
    await window.api.fs.write(made.message, buildSteeringFile(form), false)
    closeDoc('steering:new')
    void openDoc(made.message)
  }

  /** Los tres archivos base; los que ya existan no se tocan. Con el agente abierto, se le pide que los rellene. */
  const foundation = async (): Promise<void> => {
    if (!project) return
    const dir = await window.api.context.init(project, 'steering')
    const files = foundationFiles(lang)
    let created = 0
    for (const name of FOUNDATION) {
      const made = await window.api.fs.create(dir, name, false)
      if (made.ok) { await window.api.fs.write(made.message, files[name], false); created++ }
    }
    if (!created) { toast(t('stf.baseExists'), 'info'); return }
    if (askAgent && agent) await ask.send(foundationPrompt(lang, '.tutti/steering'))
    closeDoc('steering:new')
    void openDoc(`${dir}/product.md`)
  }

  return (
    <FieldsFormView title={t('stf.title')} subtitle={t('stf.subtitle')} fields={fields} values={values} onChange={set} submitLabel={t('stf.create')}
      validate={(v) => { const e = steeringFormError(v as unknown as SteeringForm); return e ? [e] : [] }}
      note={t('stf.refs')} onSubmit={create} onCancel={() => closeDoc('steering:new')}
      after={(
        <div className="mt-8 rounded-lg border border-line p-4">
          <h3 className="m-0 text-[13px] font-semibold">{t('stf.baseTitle')}</h3>
          <p className="mb-3 mt-1 text-[12px] leading-snug text-muted">{t('stf.baseBody')}</p>
          <label className={clsx('mb-3 flex items-center gap-2 text-[12px]', !agent && 'opacity-50')}>
            <input type="checkbox" checked={askAgent && !!agent} disabled={!agent} onChange={(e) => setAskAgent(e.target.checked)} className="accent-[var(--color-accent)]" />
            {t(agent ? 'stf.baseAgent' : 'stf.baseNoAgent')}
          </label>
          {askAgent && agent && <div className="mb-3"><AgentSelect options={ask.options} value={agent} onChange={ask.setPicked} /></div>}
          <button onClick={() => void foundation()} className="rounded-lg border border-line px-3 py-1.5 text-[12px] transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent">{t('stf.baseCreate')}</button>
        </div>
      )} />
  )
}
