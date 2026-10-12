import { clsx } from 'clsx'
import { useState } from 'react'
import type { MsgKey } from '@shared/i18n'
import { FIELD } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { slug } from '../lib/spec'
import { useAskAgent } from '../lib/useAskAgent'
import { AgentSelect } from './AgentSelect'
import { buildSteeringFile, EMPTY_STEERING_FORM, FOUNDATION, foundationFiles, foundationPrompt, INCLUSIONS, steeringFormError, type SteeringForm } from '../lib/steeringForm'

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
  const [form, setForm] = useState<SteeringForm>(EMPTY_STEERING_FORM)
  const [tried, setTried] = useState(false)
  const [askAgent, setAskAgent] = useState(true)
  const set = (patch: Partial<SteeringForm>): void => setForm((f) => ({ ...f, ...patch }))
  const error = steeringFormError(form)
  const ask = useAskAgent()
  const agent = ask.selected
  const bad = (field: typeof error): string => (tried && error === field ? 'ring-1 ring-danger/70' : '')
  const Label = ({ k }: { k: MsgKey }) => <label className="mb-1 mt-4 block text-[11px] font-medium text-muted">{t(k)}</label>

  const create = async (): Promise<void> => {
    setTried(true)
    if (error || !project) return
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
    <div className="selectable min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <h2 className="m-0 text-[17px] font-semibold">{t('stf.title')}</h2>
        <p className="mb-2 mt-1 text-[12px] leading-snug text-muted">{t('stf.subtitle')}</p>

        <Label k="stf.name" />
        <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('stf.namePh')} spellCheck={false} className={clsx(FIELD, bad('name'))} />
        <p className="mt-1 text-[10px] text-muted">{form.scope === 'global' ? '…/tutti/steering/' : '.tutti/steering/'}{slug(form.name) || '…'}.md</p>

        <Label k="stf.scope" />
        <div className="flex gap-1 rounded-lg border border-line p-0.5" role="radiogroup" aria-label={t('stf.scope')}>
          {(['project', 'global'] as const).map((sc) => (
            <button key={sc} role="radio" aria-checked={form.scope === sc} onClick={() => set({ scope: sc })}
              className={clsx('flex-1 rounded-md px-2 py-1 text-[12px] transition-colors', form.scope === sc ? 'bg-accent-bg font-medium text-accent' : 'text-muted hover:text-text')}>{t(`stf.s.${sc}` as MsgKey)}</button>
          ))}
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted">{t(`stf.sh.${form.scope}` as MsgKey)}</p>

        <Label k="stf.when" />
        <div className="flex gap-1 rounded-lg border border-line p-0.5" role="radiogroup" aria-label={t('stf.when')}>
          {INCLUSIONS.map((m) => (
            <button key={m} role="radio" aria-checked={form.inclusion === m} onClick={() => set({ inclusion: m })}
              className={clsx('flex-1 rounded-md px-2 py-1 text-[12px] transition-colors', form.inclusion === m ? 'bg-accent-bg font-medium text-accent' : 'text-muted hover:text-text')}>{t(`stf.m.${m}` as MsgKey)}</button>
          ))}
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted">{t(`stf.h.${form.inclusion}` as MsgKey)}</p>

        {form.inclusion === 'fileMatch' && (
          <>
            <Label k="stf.patterns" />
            <input value={form.patterns} onChange={(e) => set({ patterns: e.target.value })} placeholder="src/components/**/*.tsx, **/*.ts" spellCheck={false} className={clsx(FIELD, 'font-mono', bad('patterns'))} />
            <p className={clsx('mt-1 text-[10px]', tried && error === 'patterns' ? 'text-danger' : 'text-muted')}>{t(tried && error === 'patterns' ? 'stf.patternsNeed' : 'stf.patternsHint')}</p>
          </>
        )}
        {form.inclusion === 'auto' && (
          <>
            <Label k="stf.description" />
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder={t('stf.descriptionPh')} spellCheck={false} className={clsx(FIELD, 'resize-none', bad('description'))} />
          </>
        )}
        <p className="mt-3 text-[10px] leading-snug text-muted">{t('stf.refs')}</p>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => closeDoc('steering:new')} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button onClick={() => void create()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{t('stf.create')}</button>
        </div>

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
      </div>
    </div>
  )
}
