import { useMemo } from 'react'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { rolesProps } from '@/models/roles/rolesProps'
import { slug } from '../lib/spec'
import { useFormValues } from '../lib/useFormValues'
import { FieldsFormView } from './FieldsFormView'

/** Crear un rol como una pestaña del editor: solo el nombre; se crea .tutti/roles/<nombre>.md y se abre para escribirlo. */
export function RoleFormView() {
  const t = useT()
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const closeDoc = useStore((s) => s.closeDoc)
  const fields = useMemo(rolesProps, [])
  const { values, set } = useFormValues(fields)

  const create = async ({ name }: Record<string, string>): Promise<void> => {
    if (!project) return
    const dir = await window.api.context.init(project, 'roles')
    const made = await window.api.fs.create(dir, `${slug(name) || 'role'}.md`, false)
    if (!made.ok) { toast(made.message, 'error'); return }
    await window.api.fs.write(made.message, `# ${name}\n`, false)
    closeDoc('role:new')
    void openDoc(made.message)
  }

  return (
    <FieldsFormView title={t('rf.title')} subtitle={t('rf.subtitle')} fields={fields} values={values} onChange={set} submitLabel={t('rf.create')}
      onSubmit={create} onCancel={() => closeDoc('role:new')} />
  )
}
