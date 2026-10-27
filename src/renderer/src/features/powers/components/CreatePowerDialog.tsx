import { useEffect, useState } from 'react'
import type { PowerScope, PowerSources } from '@shared/types'
import { FIELD_SLIM, Modal } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
type Picked = { mcp: Set<string>; steering: Set<string>; skills: Set<string>; hooks: Set<string> }

/** Elige qué de lo que ya tienes (MCP, steering, skills, hooks) va a un Power nuevo; se copia, lo original no se toca. */
export function CreatePowerDialog({ scope, onClose, onDone }: { scope: PowerScope; onClose: () => void; onDone: () => void }) {
  const t = useT()
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const [sources, setSources] = useState<PowerSources | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keywords, setKeywords] = useState('')
  const [withValues, setWithValues] = useState(false)
  const [picked, setPicked] = useState<Picked>({ mcp: new Set(), steering: new Set(), skills: new Set(), hooks: new Set() })
  const [busy, setBusy] = useState(false)

  useEffect(() => { void window.api.powers.sources(project).then(setSources) }, [project])
  const toggle = (kind: keyof Picked, id: string): void => setPicked((p) => { const next = new Set(p[kind]); if (!next.delete(id)) next.add(id); return { ...p, [kind]: next } })
  const total = picked.mcp.size + picked.steering.size + picked.skills.size + picked.hooks.size
  const valid = NAME_RE.test(name.trim()) && total > 0 && !busy

  const create = async (): Promise<void> => {
    setBusy(true)
    const res = await window.api.powers.create(project, {
      name: name.trim(), description, keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean), scope, withValues,
      mcp: [...picked.mcp], steering: [...picked.steering], skills: [...picked.skills], hooks: [...picked.hooks]
    })
    setBusy(false)
    toast(res.ok ? t('powers.created', { name: name.trim() }) : res.message, res.ok ? 'ok' : 'error')
    onDone()          // aunque falle al quitar de .mcp.json, el Power ya existe
    if (res.ok) onClose()
  }

  const group = (kind: keyof Picked, title: string, items: Array<{ id: string; label: string; hint?: string }>): React.ReactNode => items.length > 0 && (
    <div key={kind} className="flex flex-col gap-0.5">
      <h5 className="pb-0.5 text-[11px] font-semibold text-muted">{title}</h5>
      {items.map((i) => (
        <label key={i.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12px] hover:bg-accent-bg">
          <input type="checkbox" checked={picked[kind].has(i.id)} onChange={() => toggle(kind, i.id)} className="accent-[var(--accent)]" />
          <span className="min-w-0 flex-1 truncate">{i.label}</span>
          {i.hint && <span className="shrink-0 truncate text-[11px] text-muted">{i.hint}</span>}
        </label>
      ))}
    </div>
  )
  const empty = sources && !sources.mcp.length && !sources.steering.length && !sources.skills.length && !sources.hooks.length

  return (
    <Modal onClose={onClose} width={460} title={t('powers.createTitle')}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('powers.name')} className={FIELD_SLIM} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('powers.description')} className={FIELD_SLIM} />
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t('powers.keywords')} className={FIELD_SLIM} />
        <h4 className="text-[12px] font-semibold">{t('powers.include')}</h4>
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {sources === null && <p className="text-[11px] text-muted">{t('powers.reading')}</p>}
          {empty && <p className="text-[11px] text-muted">{t('powers.noneToInclude')}</p>}
          {sources && group('mcp', t('powers.secMcp'), sources.mcp.map((m) => ({ id: m.name, label: m.name, hint: m.agents.join(', ') })))}
          {sources && group('steering', t('powers.secSteering'), sources.steering.map((s) => ({ id: s.id, label: s.name, hint: s.scope })))}
          {sources && group('skills', t('powers.secSkills'), sources.skills.map((s) => ({ id: s, label: s })))}
          {sources && group('hooks', t('powers.secHooks'), sources.hooks.map((h) => ({ id: h, label: h })))}
        </div>
        {picked.mcp.size > 0 && <p className="text-[11px] leading-relaxed text-muted">{t('powers.movesNote')}</p>}
        {picked.mcp.size > 0 && (
          <label className="flex cursor-pointer items-start gap-2 text-[12px]">
            <input type="checkbox" checked={withValues} onChange={(e) => setWithValues(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
            <span>{t('powers.withValues')}<span className="block text-[11px] text-muted">{t('powers.withValuesHint')}</span></span>
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
          <button disabled={!valid} onClick={() => void create()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110 disabled:opacity-40">{t('powers.create')}</button>
        </div>
      </div>
    </Modal>
  )
}
