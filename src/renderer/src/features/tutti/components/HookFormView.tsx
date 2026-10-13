import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { MdExpandMore } from 'react-icons/md'
import { Menu } from '@/shared/components/Menu'
import type { MsgKey } from '@shared/i18n'
import { FIELD } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { buildHookFile, EMPTY_HOOK_FORM, HOOK_TRIGGERS, hookFormError, slug, type HookForm } from '../lib/spec'
import { parseHookEditPath, readHookForm, replaceHook } from '../lib/hookEdit'

/**
 * Crear un hook con un formulario guiado (como en Kiro): nombre, evento, filtro de archivos y qué hacer (un comando o pedirle algo al agente).
 * Se ve como una pestaña del editor, igual que un archivo; al crearlo, la pestaña pasa al archivo JSON del hook.
 */
export function HookFormView({ path }: { path: string }) {
  const t = useT()
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const closeDoc = useStore((s) => s.closeDoc)
  const edit = parseHookEditPath(path)
  const onClose = (): void => closeDoc(path)
  // al editar, el formulario parte de lo que dice el hook en su archivo
  useEffect(() => {
    if (!edit) return
    void window.api.fs.read(edit.file).then((d) => { const f = readHookForm(d.text, edit.index); if (f) setForm(f); else { toast(t('hf.editFail'), 'error'); closeDoc(path) } }, () => { toast(t('hf.editFail'), 'error'); closeDoc(path) })
  }, [path])  // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState<HookForm>(EMPTY_HOOK_FORM)
  const [tried, setTried] = useState(false)
  const [menu, setMenu] = useState<DOMRect | null>(null)          // el desplegable de eventos, anclado al campo
  const set = (patch: Partial<HookForm>): void => setForm((f) => ({ ...f, ...patch }))
  const error = hookFormError(form)
  const trigger = HOOK_TRIGGERS.find((x) => x.id === form.trigger)
  const submit = async (): Promise<void> => {
    setTried(true)
    if (error || !project) return
    if (edit) {                                                          // guardar lo editado en su sitio
      const text = await window.api.fs.read(edit.file).then((d) => d.text, () => null)
      const next = text === null ? null : replaceHook(text, edit.index, form)
      if (next === null) { toast(t('hf.editFail'), 'error'); return }
      await window.api.fs.write(edit.file, next, false)
      closeDoc(path); void openDoc(edit.file)
      return
    }
    const dir = await window.api.context.init(project, 'hooks')           // la primera vez crea .tutti/hooks
    const made = await window.api.fs.create(dir, `${slug(form.name) || 'hook'}.json`, false)
    if (!made.ok) { toast(made.message, 'error'); return }
    await window.api.fs.write(made.message, buildHookFile(form), false)
    closeDoc(path)
    void openDoc(made.message)
  }
  const bad = (field: typeof error): string => (tried && error === field ? 'ring-1 ring-danger/70' : '')
  const Label = ({ k, children }: { k: MsgKey; children?: React.ReactNode }) => <label className="mb-1 mt-3 block text-[11px] font-medium text-muted first:mt-0">{t(k)}{children}</label>

  return (
    <div className="selectable min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <h2 className="m-0 text-[17px] font-semibold">{t(edit ? 'hf.editTitle' : 'hf.title')}</h2>
        <p className="mb-4 mt-1 text-[12px] leading-snug text-muted">{t(edit ? 'hf.editSubtitle' : 'hf.subtitle')}</p>
        <Label k="hf.name" />
        <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('hf.namePh')} spellCheck={false} className={clsx(FIELD, bad('name'))} />
        <Label k="hf.description" />
        <input value={form.description} onChange={(e) => set({ description: e.target.value })} spellCheck={false} className={FIELD} />

        <Label k="hf.trigger" />
        <button type="button" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())} aria-haspopup="menu" aria-expanded={!!menu}
          className={clsx(FIELD, 'flex cursor-pointer items-center gap-2 text-left transition-colors hover:bg-ov/[0.07]', menu && 'bg-ov/[0.07]')}>
          <span className="font-medium">{form.trigger}</span>
          <span className="min-w-0 flex-1 truncate text-muted">{t(`hf.t.${form.trigger}` as MsgKey)}</span>
          <MdExpandMore size={16} className={clsx('shrink-0 text-muted transition-transform', menu && 'rotate-180')} />
        </button>
        {menu && (
          <Menu anchor={menu} width={Math.max(300, menu.width)} onClose={() => setMenu(null)}
            items={HOOK_TRIGGERS.map((x) => ({ label: x.id, detail: t(`hf.t.${x.id}` as MsgKey), checked: form.trigger === x.id, onClick: () => set({ trigger: x.id }) }))} />
        )}
        {trigger && !trigger.runs && <p className="mt-1 text-[10px] leading-snug text-warn">{t('tutti.hookNoRun')}</p>}

        <Label k="hf.matcher" />
        <input value={form.matcher} onChange={(e) => set({ matcher: e.target.value })} placeholder="\.(ts|tsx)$" spellCheck={false} className={clsx(FIELD, 'font-mono', bad('matcher'))} />
        <p className={clsx('mt-1 text-[10px]', tried && error === 'matcher' ? 'text-danger' : 'text-muted')}>{tried && error === 'matcher' ? t('hf.matcherBad') : t('hf.matcherHint')}</p>

        <Label k="hf.action" />
        <div className="flex gap-1 rounded-lg border border-line p-0.5" role="radiogroup">
          {(['agent', 'command'] as const).map((a) => (
            <button key={a} role="radio" aria-checked={form.action === a} onClick={() => set({ action: a })}
              className={clsx('flex-1 rounded-md px-2 py-1 text-[12px] transition-colors', form.action === a ? 'bg-accent-bg font-medium text-accent' : 'text-muted hover:text-text')}>{t(`hf.a.${a}` as MsgKey)}</button>
          ))}
        </div>

        {form.action === 'agent' ? (
          <>
            <Label k="hf.prompt" />
            <textarea value={form.prompt} onChange={(e) => set({ prompt: e.target.value })} rows={4} placeholder={t('hf.promptPh')} spellCheck={false} className={clsx(FIELD, 'resize-none', bad('prompt'))} />
          </>
        ) : (
          <>
            <Label k="hf.command" />
            <input value={form.command} onChange={(e) => set({ command: e.target.value })} placeholder="npx eslint --fix $TUTTI_HOOK_FILE" spellCheck={false} className={clsx(FIELD, 'font-mono', bad('command'))} />
            <p className="mt-1 text-[10px] text-muted">{t('hf.commandHint')}</p>
            <Label k="hf.timeout" />
            <input value={form.timeout} onChange={(e) => set({ timeout: e.target.value })} inputMode="numeric" spellCheck={false} className={clsx(FIELD, 'w-24', bad('timeout'))} />
          </>
        )}
        <p className="mt-3 text-[10px] leading-snug text-muted">{t('hf.trustNote')}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button onClick={() => void submit()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110">{t(edit ? 'hf.save' : 'hf.create')}</button>
        </div>
      </div>
    </div>
  )
}
