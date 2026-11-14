import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { MdSearch } from 'react-icons/md'
import type { MsgKey } from '@/shared/i18n'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import { DEFAULT_EDITOR_FONT } from '@/renderer/src/shared/store/ui'
import { FIELD, Modal, Select } from '@/renderer/src/shared/components/ui'

type Control = { kind: 'number'; value: string } | { kind: 'check'; value: boolean } | { kind: 'select'; value: string; options: string[] } | { kind: 'text'; value: string }
interface Setting { id: string; group: string; title: string; help: string; control: Control }

/** Ajustes del editor, a la manera de la pantalla de configuración de un IDE: buscador, apartados a la izquierda y la lista a la derecha. Por ahora solo la familia de fuente se guarda y se aplica; el resto es solo vista. */
const SETTINGS: Setting[] = [
  { id: 'fontSize', group: 'font', title: 'ed.fontSize.t', help: 'ed.fontSize.h', control: { kind: 'number', value: '14' } },
  { id: 'fontFamily', group: 'font', title: 'ed.fontFamily.t', help: 'ed.fontFamily.h', control: { kind: 'text', value: DEFAULT_EDITOR_FONT } },
  { id: 'ligatures', group: 'font', title: 'ed.ligatures.t', help: 'ed.ligatures.h', control: { kind: 'check', value: true } },
  { id: 'wordWrap', group: 'text', title: 'ed.wordWrap.t', help: 'ed.wordWrap.h', control: { kind: 'select', value: 'off', options: ['off', 'on'] } },
  { id: 'lineNumbers', group: 'text', title: 'ed.lineNumbers.t', help: 'ed.lineNumbers.h', control: { kind: 'check', value: true } },
  { id: 'formatOnSave', group: 'files', title: 'ed.formatOnSave.t', help: 'ed.formatOnSave.h', control: { kind: 'check', value: false } },
  { id: 'agentNotes', group: 'agents', title: 'ed.agentNotes.t', help: 'ed.agentNotes.h', control: { kind: 'check', value: false } },
  { id: 'autoSave', group: 'files', title: 'ed.autoSave.t', help: 'ed.autoSave.h', control: { kind: 'select', value: 'off', options: ['off', 'afterDelay', 'onFocusChange'] } }
]
const GROUPS = ['all', 'font', 'text', 'files', 'agents'] as const

export function EditorSettingsDialog() {
  const t = useT()
  const set = useStore((s) => s.set)
  const editorFont = useStore((s) => s.editorFont)
  const setEditorFont = useStore((s) => s.setEditorFont)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('all')
  const [values, setValues] = useState<Record<string, Control['value']>>(() => ({ ...Object.fromEntries(SETTINGS.map((x) => [x.id, x.control.value])), fontFamily: editorFont }))
  // la pizarra de notas entre agentes vive en los ajustes de la app (la lee el servidor MCP)
  useEffect(() => { void window.api.settings.get('agent_notes').then((v) => setValues((p) => ({ ...p, agentNotes: v === true }))) }, [])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SETTINGS.filter((x) => (group === 'all' || x.group === group) && (!q || `${t(x.title as MsgKey)} ${t(x.help as MsgKey)}`.toLowerCase().includes(q)))
  }, [query, group, t])

  return (
    <Modal onClose={() => set({ modal: null, focus: 'pane' })} width={820} title={t('editor.title')}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="relative">
          <MdSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className={clsx(FIELD, 'pl-8')} placeholder={t('editor.search')} value={query} autoFocus spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex h-[56vh] min-h-0 gap-4">
          <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-line pr-3">
            {GROUPS.map((g) => (
              <button key={g} onClick={() => setGroup(g)}
                className={clsx('rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-ov/[0.06]', group === g ? 'bg-accent-bg text-text' : 'text-muted')}>{t(`ed.g.${g}` as MsgKey)}</button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto pr-2">
            {shown.length === 0 && <p className="text-[12px] text-muted">{t('editor.none')}</p>}
            {shown.map((x) => {
              const v = values[x.id]
              const change = (n: Control['value']): void => { setValues((p) => ({ ...p, [x.id]: n })); if (x.id === 'fontFamily') setEditorFont(n as string); if (x.id === 'agentNotes') void window.api.settings.set('agent_notes', n) }
              return (
                <div key={x.id} className="flex flex-col gap-1.5">
                  <div className="text-[12px]"><span className="text-muted">{t('ed.prefix')} </span><b className="font-semibold text-text">{t(x.title as MsgKey)}</b></div>
                  <p className="m-0 text-[12px] text-muted">{t(x.help as MsgKey)}</p>
                  <div className="max-w-sm">
                    {x.control.kind === 'check'
                      ? <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={v as boolean} onChange={(e) => change(e.target.checked)} />
                      : x.control.kind === 'select'
                        ? <Select value={v as string} options={x.control.options.map((o) => ({ value: o, label: o }))} onChange={change} />
                        : <input className={FIELD} value={v as string} spellCheck={false} onChange={(e) => change(e.target.value)} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
