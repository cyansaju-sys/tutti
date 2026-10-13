import { clsx } from 'clsx'
import { useState } from 'react'
import { MdChevronRight, MdEditNote, MdSmartToy } from 'react-icons/md'
import { FIELD, Modal } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { hookAgentPrompt } from '../lib/hookEdit'
import { useAskAgent } from '../lib/useAskAgent'
import { AgentSelect } from './AgentSelect'

/**
 * Crear un hook, como el selector de Kiro: ¿con un formulario guiado o describiéndoselo al agente abierto? El formulario se abre como una
 * pestaña del editor; el agente escribe el JSON, te lo enseña y lo guarda apagado hasta que lo apruebes.
 */
export function HookChoiceDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const openHookForm = useStore((s) => s.openHookForm)
  const toast = useStore((s) => s.toast)
  const [step, setStep] = useState<'choose' | 'describe'>('choose')
  const [idea, setIdea] = useState('')
  const ask = useAskAgent()
  const agent = ask.selected

  const send = async (): Promise<void> => {
    if (!agent || !idea.trim()) return
    await ask.send(hookAgentPrompt(lang, idea))
    onClose()
  }
  const Option = ({ icon, title, hint, onClick, off }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void; off?: boolean }) => (
    <button onClick={onClick} disabled={off}
      className={clsx('flex w-full items-center gap-3 rounded-lg border border-line px-3.5 py-3 text-left transition-colors', off ? 'cursor-not-allowed opacity-45' : 'hover:border-accent hover:bg-accent-bg')}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ov/[0.06] text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11px] leading-snug text-muted">{hint}</span>
      </span>
      {!off && <MdChevronRight size={18} className="shrink-0 text-muted" />}
    </button>
  )

  return (
    <Modal onClose={onClose} width={460} title={t('hc.title')}>
      <div className="flex flex-col gap-2 px-4 pb-4">
        {step === 'choose' ? (
          <>
            <Option icon={<MdEditNote size={18} />} title={t('hc.form')} hint={t('hc.formHint')} onClick={() => { onClose(); openHookForm() }} />
            <Option icon={<MdSmartToy size={18} />} title={t('hc.agent')} hint={agent ? t('hc.agentHint') : t('sf.noAgent')} off={!agent} onClick={() => setStep('describe')} />
          </>
        ) : (
          <>
            <label className="text-[11px] font-medium text-muted">{t('hf.nl')}</label>
            <textarea autoFocus value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} placeholder={t('hf.nlPh')} spellCheck={false}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send() }} className={clsx(FIELD, 'resize-none')} />
            <p className="text-[10px] leading-snug text-muted">{t('hf.nlHint')}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <button onClick={() => setStep('choose')} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('hc.back')}</button>
              <span className="flex items-center gap-2">
                <AgentSelect options={ask.options} value={agent} onChange={ask.setPicked} />
                <button onClick={() => void send()} disabled={!idea.trim()} className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-medium text-bg transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{t('hf.nlSend')}</button>
              </span>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
