import { clsx } from 'clsx'
import { useState } from 'react'
import type { MsgKey } from '@shared/i18n'
import { FIELD } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { slug } from '../lib/spec'
import { useAskAgent } from '../lib/useAskAgent'
import { AgentSelect } from './AgentSelect'
import { changeFiles, changeFormError, EMPTY_CHANGE_FORM, proposePrompt, type ChangeForm } from '../lib/openspec'

/** Una fila de botones para elegir una opción. */
function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ id: T; text: string; off?: boolean; hint?: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex gap-1 rounded-lg border border-line p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} disabled={o.off} title={o.hint} onClick={() => onChange(o.id)}
          className={clsx('flex-1 rounded-md px-2 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40', value === o.id ? 'bg-accent-bg font-medium text-accent' : 'text-muted hover:text-text')}>{o.text}</button>
      ))}
    </div>
  )
}

/**
 * Proponer un cambio de OpenSpec, como una pestaña del editor: su nombre (la carpeta en openspec/changes), qué se quiere y quién redacta los
 * archivos: plantillas vacías o el agente abierto, que no escribe código hasta que lo pidas.
 */
export function SpecFormView() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const closeDoc = useStore((s) => s.closeDoc)
  const [form, setForm] = useState<ChangeForm>(EMPTY_CHANGE_FORM)
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<ChangeForm>): void => setForm((f) => ({ ...f, ...patch }))
  const error = changeFormError(form)
  const ask = useAskAgent()
  const agent = ask.selected
  const bad = (field: typeof error): string => (tried && error === field ? 'ring-1 ring-danger/70' : '')
  const Label = ({ k }: { k: MsgKey }) => <label className="mb-1 mt-4 block text-[11px] font-medium text-muted">{t(k)}</label>
  const name = slug(form.name)

  const submit = async (): Promise<void> => {
    setTried(true)
    if (error || !project) return
    const state = await window.api.openspec.state(project)
    if (!state.initialized) { toast(t('os.notInit'), 'error'); return }
    const made = await window.api.fs.create(`${project}/openspec/changes`, name, true)
    if (!made.ok) { toast(made.message, 'error'); return }
    for (const [file, text] of Object.entries(changeFiles(lang, form))) {
      const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
      let folder = made.message
      for (const part of dir.split('/').filter(Boolean)) {
        folder = `${folder}/${part}`
        await window.api.fs.create(folder.slice(0, folder.lastIndexOf('/')), part, true)
      }
      const created = await window.api.fs.create(folder, file.slice(file.lastIndexOf('/') + 1), false)
      if (created.ok) await window.api.fs.write(created.message, text, false)
    }
    if (form.useAgent && agent) await ask.send(proposePrompt(lang, name, form.description))
    closeDoc('spec:new')
    void openDoc(`${made.message}/proposal.md`)
  }

  return (
    <div className="selectable min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <h2 className="m-0 text-[17px] font-semibold">{t('sf.title')}</h2>
        <p className="mb-2 mt-1 text-[12px] leading-snug text-muted">{t('sf.subtitle')}</p>

        <Label k="sf.name" />
        <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('sf.namePh')} spellCheck={false} className={clsx(FIELD, bad('name'))} />
        <p className="mt-1 text-[10px] text-muted">openspec/changes/{name || '…'}/</p>

        <Label k="sf.describe" />
        <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={5} spellCheck={false}
          placeholder={t('sf.describePh')} className={clsx(FIELD, 'resize-none', bad('description'))} />

        <Label k="sf.who" />
        <Choice label={t('sf.who')} value={form.useAgent ? 'agent' : 'template'} onChange={(v) => set({ useAgent: v === 'agent' })}
          options={[{ id: 'template', text: t('sf.template') }, { id: 'agent', text: t('sf.agent'), off: !agent, hint: agent ? undefined : t('sf.noAgent') }]} />
        <p className={clsx('mt-1 text-[10px] leading-snug', tried && error === 'description' ? 'text-danger' : 'text-muted')}>
          {tried && error === 'description' ? t('sf.needDescription') : agent ? t(form.useAgent ? 'sf.agentHint' : 'sf.templateHint') : t('sf.noAgent')}
        </p>
        {form.useAgent && agent && <div className="mt-2"><AgentSelect options={ask.options} value={agent} onChange={ask.setPicked} /></div>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => closeDoc('spec:new')} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button onClick={() => void submit()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{t('sf.create')}</button>
        </div>
      </div>
    </div>
  )
}
