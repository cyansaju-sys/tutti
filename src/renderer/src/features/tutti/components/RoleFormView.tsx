import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import { basename } from '@/renderer/src/shared/lib/paths'
import { rolesProps } from '@/renderer/src/models/roles/rolesProps'
import { slug } from '@/renderer/src/features/tutti/lib/spec'
import { useAskAgent } from '@/renderer/src/features/tutti/lib/useAskAgent'
import { useFormValues } from '@/renderer/src/features/tutti/lib/useFormValues'
import { FieldsFormView } from './FieldsFormView'

/** El archivo del rol: cabecera con name, difficulty, depends-on, agent y model, y el resto (especialidad, entregable, descripción) como secciones de Markdown. Los campos vacíos también se escriben. */
function roleFile(v: Record<string, string>, t: ReturnType<typeof useT>): string {
  const head = [`name: ${slug(v.name) || 'role'}`, `difficulty: ${v.difficulty ?? ''}`, `depends-on: ${v.dependsOn ?? ''}`, `agent: ${v.agent ?? ''}`, `model: ${v.model ?? ''}`]
  const section = (key: 'rf.specialty' | 'rf.deliverable' | 'rf.description', text: string): string => `## ${t(key)}\n\n${text}`.trimEnd()
  const body = [`# ${v.name}`, section('rf.specialty', v.specialty ?? ''), section('rf.deliverable', v.deliverable ?? ''), section('rf.description', v.description ?? '')]
  return `---\n${head.join('\n')}\n---\n\n${body.join('\n\n')}\n`
}

/** Lo contrario de `roleFile`: los valores del formulario a partir del archivo (el título es el nombre; las tres secciones, por orden). */
function readRole(text: string): Record<string, string> {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
  const key = (k: string): string => new RegExp(`^${k}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(head)?.[1] ?? ''
  const body = text.slice(head ? text.indexOf('---', 3) + 3 : 0)
  const [, ...sections] = body.split(/^## .*$/m)
  const nth = (i: number): string => (sections[i] ?? '').trim()
  return { name: /^# (.*)$/m.exec(body)?.[1]?.trim() ?? key('name'), difficulty: key('difficulty'), dependsOn: key('depends-on'), agent: key('agent'), model: key('model'), specialty: nth(0), deliverable: nth(1), description: nth(2) }
}

/** Crear un rol (o editar uno que ya existe: `path` = «role:edit:<archivo>») como una pestaña del editor; se guarda en .tutti/roles (o .agents/roles). */
export function RoleFormView({ path }: { path: string }) {
  const t = useT()
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const closeDoc = useStore((s) => s.closeDoc)
  const editFile = path.startsWith('role:edit:') ? path.slice('role:edit:'.length) : null
  const ask = useAskAgent()
  const [root, setRoot] = useState('.tutti')          // .tutti, o .agents si el proyecto ya lo usa
  const [roles, setRoles] = useState<string[]>([])          // los roles que ya existen, para «depende de»
  useEffect(() => {
    if (!project) return
    void window.api.context.dir(project).then((dir) => { setRoot(basename(dir)); return window.api.fs.list(`${dir}/roles`) }).then((l) => setRoles(l.filter((e) => !e.isDir).map((e) => e.name.replace(/\.md$/i, ''))), () => setRoles([]))
  }, [project])
  const agents = useMemo(() => [...new Map(ask.options.map((o) => [o.command, { command: o.command, name: o.name }])).values()], [ask.options])
  const [models, setModels] = useState<Record<string, string[]>>({})          // los modelos de cada agente, leídos al elegirlo
  const fields = useMemo(() => rolesProps({ agents, roles: roles.filter((r) => r !== (editFile ? basename(editFile).replace(/\.md$/i, '') : '')), root, models }), [agents, roles, root, models, editFile])
  const { values, set, reset } = useFormValues(fields)
  const loaded = useRef(false)          // el agente cambió porque se cargó el rol que se edita: su modelo se conserva
  // al editar, el formulario parte de lo que dice el archivo del rol
  useEffect(() => {
    if (!editFile) return
    void window.api.fs.read(editFile).then((d) => { loaded.current = true; reset(readRole(d.text)) }, () => { toast(t('rf.editFail'), 'error'); closeDoc(path) })
  }, [path])  // eslint-disable-line react-hooks/exhaustive-deps
  // al cambiar de agente se piden sus modelos y se vuelve al por defecto (el modelo anterior puede no ser suyo)
  useEffect(() => {
    if (loaded.current) loaded.current = false; else set({ model: '' })
    const command = values.agent
    if (!command || models[command]) return
    void window.api.agents.models(command, project ?? undefined).then((list) => setModels((m) => ({ ...m, [command]: list })), () => setModels((m) => ({ ...m, [command]: [] })))
  }, [values.agent])  // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (v: Record<string, string>): Promise<void> => {
    if (!project) return
    const { name } = v
    if (editFile) {                                                      // guardar lo editado en su archivo (y renombrarlo si cambió el nombre)
      await window.api.fs.write(editFile, roleFile(v, t), false)
      let file = editFile
      const wanted = `${slug(name) || 'role'}.md`
      if (basename(editFile) !== wanted) {
        const res = await window.api.fs.rename(editFile, wanted)
        if (!res.ok) toast(res.message, 'error'); else { useStore.getState().renameDocs(editFile, res.message); file = res.message }
      }
      closeDoc(path); void openDoc(file)
      return
    }
    const dir = await window.api.context.init(project, 'roles')
    const made = await window.api.fs.create(dir, `${slug(name) || 'role'}.md`, false)
    if (!made.ok) { toast(made.message, 'error'); return }
    await window.api.fs.write(made.message, roleFile(v, t), false)
    closeDoc(path)
    void openDoc(made.message)
  }

  return (
    <FieldsFormView title={t(editFile ? 'rf.editTitle' : 'rf.title')} subtitle={t('rf.subtitle', { root })} fields={fields} values={values} onChange={set} submitLabel={t(editFile ? 'rf.save' : 'rf.create')}
      onSubmit={create} onCancel={() => closeDoc(path)} />
  )
}
