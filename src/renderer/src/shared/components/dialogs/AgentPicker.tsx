import { useEffect } from 'react'
import { MdAdd } from 'react-icons/md'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { AgentIcon } from '@/features/agents/components/AgentIcon'
import { Modal } from '@/shared/components/ui'
import { Palette } from './Palette'
import { Chip, Tag } from './parts'

export function AgentPicker() {
  const t = useT()
  const set = useStore((s) => s.set)
  const project = useStore((s) => s.project)
  const agents = useStore((s) => s.agents)
  const openAgent = useStore((s) => s.openAgent)
  useEffect(() => { void window.api.agents.detect().then((a) => set({ agents: a })) }, [set])
  return (
    <Modal onClose={() => set({ modal: null, focus: 'pane' })} width={560}>
      {!project ? (
        <p className="px-4 py-5 text-[12px] text-muted">{t('dlg.openProjectFirst')}</p>
      ) : (
        <Palette
          placeholder={t('dlg.searchAgent')} items={agents} label={(a) => a.name} empty={agents.length ? t('dlg.noAgentMatch') : t('dlg.noAgents')}
          render={(a) => (<><span className="grid size-7 shrink-0 place-items-center"><AgentIcon name={a.name} command={a.command} size={22} /></span><span className="flex-1 truncate">{a.name}</span><Tag>{a.command}</Tag></>)}
          onPick={(a) => { if (a) void openAgent(a) }}
          footer={() => (
            <button onClick={() => set({ modal: 'addAgent' })}
              className="mx-2 mb-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2 text-left text-[12px] text-muted transition-colors hover:border-accent/50 hover:bg-accent-bg/70 hover:text-accent">
              <Chip active={false}><MdAdd size={15} /></Chip> {t('dlg.addOther')}
            </button>)}
        />
      )}
    </Modal>
  )
}
