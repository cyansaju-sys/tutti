import { clsx } from 'clsx'
import { useState } from 'react'
import type { MsgKey } from '@shared/i18n'
import { FIELD } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { slug } from '../lib/spec'
import { buildSkillFile, EMPTY_SKILL_FORM, skillAgentPrompt, skillFormError, type SkillForm } from '../lib/skillForm'

/** Crear una skill como una pestaña del editor: nombre, cuándo usarla y las instrucciones (o pedirle al agente que las redacte). */
export function SkillFormView() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const project = useStore((s) => s.project)
  const panes = useStore((s) => s.panes)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const closeDoc = useStore((s) => s.closeDoc)
  const [form, setForm] = useState<SkillForm>(EMPTY_SKILL_FORM)
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<SkillForm>): void => setForm((f) => ({ ...f, ...patch }))
  const error = skillFormError(form)
  const agent = panes.find((p) => p.id === useStore.getState().activePane && p.kind === 'agent') ?? panes.find((p) => p.kind === 'agent')
  const bad = (field: typeof error): string => (tried && error === field ? 'ring-1 ring-danger/70' : '')
  const Label = ({ k }: { k: MsgKey }) => <label className="mb-1 mt-4 block text-[11px] font-medium text-muted">{t(k)}</label>
  const useAgent = form.useAgent && !!agent

  /** Importa una skill que ya tienes: se elige su carpeta (con su SKILL.md) y se copia a .tutti/skills. */
  const importExisting = async (): Promise<void> => {
    if (!project) return
    const source = await window.api.dialog.chooseFolder(project)
    if (!source) return
    const res = await window.api.skills.import(project, source)
    if (!res.ok) { toast(res.message, 'error'); return }
    toast(t('skf.imported'), 'ok')
    closeDoc('skill:new')
    void openDoc(res.message)
  }

  const create = async (): Promise<void> => {
    setTried(true)
    if (error || !project) return
    const dir = await window.api.context.init(project, 'skills')
    const folder = slug(form.name) || 'skill'
    const made = await window.api.fs.create(dir, folder, true)
    if (!made.ok) { toast(made.message, 'error'); return }
    const file = `${made.message}/SKILL.md`
    await window.api.fs.write(file, buildSkillFile(lang, form), false)
    if (useAgent && agent) {
      window.api.pty.paste(agent.id, skillAgentPrompt(lang, form, `.tutti/skills/${folder}`))
      setTimeout(() => window.api.pty.write(agent.id, '\r'), 500)
    }
    closeDoc('skill:new')
    void openDoc(file)
  }

  return (
    <div className="selectable min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <h2 className="m-0 text-[17px] font-semibold">{t('skf.title')}</h2>
        <p className="mb-2 mt-1 text-[12px] leading-snug text-muted">{t('skf.subtitle')}</p>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
          <span className="text-[11px] leading-snug text-muted">{t('skf.importHint')}</span>
          <button onClick={() => void importExisting()} className="shrink-0 rounded-lg border border-line px-3 py-1 text-[12px] transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent">{t('skf.import')}</button>
        </div>

        <Label k="skf.name" />
        <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('skf.namePh')} spellCheck={false} className={clsx(FIELD, bad('name'))} />
        <p className="mt-1 text-[10px] text-muted">.tutti/skills/{slug(form.name) || '…'}/SKILL.md</p>

        <Label k="skf.description" />
        <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3} placeholder={t('skf.descriptionPh')} spellCheck={false} className={clsx(FIELD, 'resize-none', bad('description'))} />
        <p className={clsx('mt-1 text-[10px] leading-snug', tried && error === 'description' ? 'text-danger' : 'text-muted')}>{t(tried && error === 'description' ? 'skf.descriptionNeed' : 'skf.descriptionHint')}</p>

        <Label k="skf.instructions" />
        <textarea value={form.instructions} onChange={(e) => set({ instructions: e.target.value })} rows={6} placeholder={t('skf.instructionsPh')} spellCheck={false} disabled={useAgent} className={clsx(FIELD, 'resize-none font-mono disabled:opacity-50')} />
        <p className="mt-1 text-[10px] text-muted">{t('skf.instructionsHint')}</p>

        <label className={clsx('mt-4 flex items-center gap-2 text-[12px]', !agent && 'opacity-50')}>
          <input type="checkbox" checked={useAgent} disabled={!agent} onChange={(e) => set({ useAgent: e.target.checked })} className="accent-[var(--color-accent)]" />
          {t(agent ? 'skf.agent' : 'skf.noAgent')}
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => closeDoc('skill:new')} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button onClick={() => void create()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{t('skf.create')}</button>
        </div>
      </div>
    </div>
  )
}
