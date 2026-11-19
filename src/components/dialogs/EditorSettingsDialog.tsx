import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { MdSearch } from 'react-icons/md'
import type { MsgKey } from '@/shared/i18n'
import { useT } from '@/lib/i18n'
import { useStore } from '@/store'
import { DEFAULT_EDITOR_FONT } from '@/store/ui'
import { Modal, Select } from '@/components/ui'

type Control = { kind: 'number'; value: string } | { kind: 'check'; value: boolean } | { kind: 'select'; value: string; options: string[] } | { kind: 'text'; value: string }
interface Setting { id: string; group: string; title: string; help: string; control: Control }

/** Ajustes del editor, a la manera de la pantalla de configuración de un IDE: buscador, apartados a la izquierda y la lista a la derecha. Por ahora solo la familia de fuente se guarda y se aplica; el resto es solo vista. */
const SETTINGS: Setting[] = [
  { id: 'fontSize', group: 'font', title: 'ed.fontSize.t', help: 'ed.fontSize.h', control: { kind: 'number', value: '14' } },
  { id: 'fontFamily', group: 'font', title: 'ed.fontFamily.t', help: 'ed.fontFamily.h', control: { kind: 'text', value: DEFAULT_EDITOR_FONT } },
  { id: 'ligatures', group: 'font', title: 'ed.ligatures.t', help: 'ed.ligatures.h', control: { kind: 'check', value: true } },
  { id: 'fullWidth', group: 'text', title: 'ed.fullWidth.t', help: 'ed.fullWidth.h', control: { kind: 'check', value: false } },
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
  const editorFull = useStore((s) => s.editorFull)
  const setEditorFull = useStore((s) => s.setEditorFull)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('all')
  const [values, setValues] = useState<Record<string, Control['value']>>(() => ({ ...Object.fromEntries(SETTINGS.map((x) => [x.id, x.control.value])), fontFamily: editorFont, fullWidth: editorFull }))
  // la pizarra de notas entre agentes vive en los ajustes de la app (la lee el servidor MCP)
  useEffect(() => { void window.api.settings.get('agent_notes').then((v) => setValues((p) => ({ ...p, agentNotes: v === true }))) }, [])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SETTINGS.filter((x) => (group === 'all' || x.group === group) && (!q || `${t(x.title as MsgKey)} ${t(x.help as MsgKey)}`.toLowerCase().includes(q)))
  }, [query, group, t])

  // estilo de la pantalla de ajustes de VSCode: buscador plano, categorías sin relleno y cada ajuste con una barra de acento al pasar el ratón
  const FLAT = 'h-7 w-full rounded-[3px] border border-line bg-transparent px-2 text-[12px] font-light text-text outline-none transition-colors placeholder:text-muted focus:border-accent'
  return (
    <Modal onClose={() => set({ modal: null, focus: 'pane' })} width={820} title={t('editor.title')}>
      <div className="flex flex-col gap-2 px-2 pb-2">
        <div className="relative">
          <MdSearch size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          <input className={clsx(FLAT, 'pl-7')} placeholder={t('editor.search')} value={query} autoFocus spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex h-[56vh] min-h-0 gap-2">
          <nav className="flex w-36 shrink-0 flex-col border-r border-line pr-1.5">
            {GROUPS.map((g) => (
              <button key={g} onClick={() => setGroup(g)}
                className={clsx('rounded-[3px] px-2 py-[2px] text-left text-[12px] font-light transition-colors hover:bg-ov/[0.06]', group === g ? 'bg-accent/30 text-text' : 'text-muted')}>{t(`ed.g.${g}` as MsgKey)}</button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            {shown.length === 0 && <p className="px-2 text-[12px] font-light text-muted">{t('editor.none')}</p>}
            {shown.map((x) => {
              const v = values[x.id]
              const change = (n: Control['value']): void => { setValues((p) => ({ ...p, [x.id]: n })); if (x.id === 'fontFamily') setEditorFont(n as string); if (x.id === 'fullWidth') setEditorFull(n as boolean); if (x.id === 'agentNotes') void window.api.settings.set('agent_notes', n) }
              const check = x.control.kind === 'check'
              return (
                <div key={x.id} className="flex flex-col gap-1 border-l-2 border-transparent px-2 py-1.5 transition-colors hover:border-accent hover:bg-ov/[0.03]">
                  <div className="text-[13px] font-light"><span className="text-muted">{t('ed.prefix')} </span><b className="font-medium text-text">{t(x.title as MsgKey)}</b></div>
                  {check ? (
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]" checked={v as boolean} onChange={(e) => change(e.target.checked)} />
                      <span className="text-[12px] font-light text-muted">{t(x.help as MsgKey)}</span>
                    </label>
                  ) : (
                    <>
                      <p className="m-0 text-[12px] font-light text-muted">{t(x.help as MsgKey)}</p>
                      <div className="max-w-sm">
                        {x.control.kind === 'select'
                          ? <Select value={v as string} options={x.control.options.map((o) => ({ value: o, label: o }))} onChange={change} />
                          : <input className={FLAT} value={v as string} spellCheck={false} onChange={(e) => change(e.target.value)} />}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
