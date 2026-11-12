import { useEffect, useMemo } from 'react'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { hooksProps } from '@/models/hooks/hooksProps'
import { buildHookFile, hookFormError, slug, type HookForm } from '../lib/spec'
import { parseHookEditPath, readHookForm, replaceHook } from '../lib/hookEdit'
import { useFormValues } from '../lib/useFormValues'
import { FieldsFormView } from './FieldsFormView'

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
  const fields = useMemo(hooksProps, [])
  const { values, set, reset } = useFormValues(fields)
  // al editar, el formulario parte de lo que dice el hook en su archivo
  useEffect(() => {
    if (!edit) return
    void window.api.fs.read(edit.file).then((d) => { const f = readHookForm(d.text, edit.index); if (f) reset({ ...f }); else { toast(t('hf.editFail'), 'error'); closeDoc(path) } }, () => { toast(t('hf.editFail'), 'error'); closeDoc(path) })
  }, [path])  // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (v: Record<string, string>): Promise<void> => {
    const form = v as unknown as HookForm
    if (!project) return
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

  return (
    <FieldsFormView title={t(edit ? 'hf.editTitle' : 'hf.title')} subtitle={t(edit ? 'hf.editSubtitle' : 'hf.subtitle')} fields={fields} values={values} onChange={set}
      submitLabel={t(edit ? 'hf.save' : 'hf.create')} validate={(v) => { const e = hookFormError(v as unknown as HookForm); return e ? [e] : [] }}
      note={t('hf.trustNote')} onSubmit={submit} onCancel={() => closeDoc(path)} />
  )
}
