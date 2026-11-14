import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { MdTerminal } from 'react-icons/md'
import type { AgentCandidate } from '@/shared/types'
import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import { AgentIcon } from '@/renderer/src/features/agents/components/AgentIcon'
import { FIELD, Modal } from '@/renderer/src/shared/components/ui'
import { matches } from './helpers'

/** Añadir un agente que la app no conoce: se escribe su comando o se elige uno de los ejecutables instalados. */
export function AddAgentDialog() {
  const t = useT()
  const set = useStore((s) => s.set)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [filter, setFilter] = useState('')
  const [candidates, setCandidates] = useState<AgentCandidate[]>([])
  const [error, setError] = useState('')
  useEffect(() => { void window.api.agents.candidates().then(setCandidates) }, [])
  const shown = useMemo(() => candidates.filter((c) => matches(c.name, filter)).slice(0, 60), [candidates, filter])
  const pick = (c: AgentCandidate): void => {
    setCommand(c.name)
    if (!name.trim()) setName(c.name.charAt(0).toUpperCase() + c.name.slice(1))
    setError('')
  }
  const save = async (): Promise<void> => {
    const r = await window.api.agents.addCustom(name, command)
    if (!r.ok) { setError(r.message); return }
    set({ agents: await window.api.agents.detect(), modal: null })
  }
  return (
    <Modal onClose={() => set({ modal: null, focus: 'pane' })} width={500} title={t('dlg.addAgent')}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-[12px] text-muted">{t('dlg.addAgentHelp')}</p>
        <div className="flex items-center gap-3">
          <AgentIcon name={name || '?'} command={command.trim().split(/\s+/)[0] || name || '?'} size={36} />
          <input className={FIELD} placeholder={t('dlg.agentName')} value={name} onChange={(e) => { setName(e.target.value); setError('') }} spellCheck={false} />
        </div>
        <input className={FIELD} placeholder={t('dlg.agentCommand')} value={command} autoFocus
          onChange={(e) => { setCommand(e.target.value); setError('') }} onKeyDown={(e) => { if (e.key === 'Enter') void save() }} spellCheck={false} />
        <div>
          <input className={FIELD} placeholder={t('dlg.searchExecutables', { n: candidates.length })} value={filter} onChange={(e) => setFilter(e.target.value)} spellCheck={false} />
          <ul className="mt-1.5 max-h-[170px] overflow-y-auto rounded-lg bg-black/20 p-1">
            {shown.map((c) => (
              <li key={c.path}>
                <button onClick={() => pick(c)} title={c.path}
                  className={clsx('flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-accent-bg', command === c.name && 'bg-accent/15 text-accent')}>
                  <MdTerminal size={14} className="shrink-0 text-muted" /><span className="truncate">{c.name}</span>
                  <span className="ml-auto truncate pl-3 font-mono text-[10px] text-muted">{c.path.replace(/[\\/][^\\/]+$/, '')}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-3 text-center text-[11px] text-muted">{candidates.length ? t('dlg.noExecMatch') : t('dlg.noExecFound')}</li>}
          </ul>
        </div>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => set({ modal: null, focus: 'pane' })} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:bg-ov/[0.06]">{t('dlg.cancel')}</button>
          <button onClick={() => void save()} disabled={!name.trim() || !command.trim()}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-medium text-bg transition-colors hover:brightness-110 disabled:opacity-40">{t('dlg.add')}</button>
        </div>
      </div>
    </Modal>
  )
}
