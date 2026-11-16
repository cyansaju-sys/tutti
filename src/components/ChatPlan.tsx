import { useState } from 'react'
import { Markdown } from '@/features/files/components/Markdown'
import { useT } from '@/lib/i18n'
import type { ChatPlanDecision } from '@/shared/types'

/** El plan que Claude presenta al salir del modo plan: se lee completo y se aprueba (con o sin aceptar las ediciones solas) o se piden cambios. */
export function ChatPlanCard({ plan, onDecide }: { plan: string; onDecide: (d: ChatPlanDecision) => void }) {
  const t = useT()
  const [feedback, setFeedback] = useState('')
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent/50 bg-accent-bg px-2.5 py-2.5">
      <div className="text-[12px] font-medium text-text">{t('chat.planTitle')}</div>
      {plan
        ? <div className="max-h-80 min-w-0 overflow-y-auto rounded-md bg-panel/60 px-2.5 py-2 [overflow-wrap:anywhere]"><Markdown text={plan} /></div>
        : <div className="text-[11px] text-muted">{t('chat.planAbove')}</div>}
      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder={t('chat.planFeedback')} spellCheck={false}
        className="w-full resize-none rounded-md border border-line bg-panel px-2 py-1.5 text-[11.5px] text-text outline-none placeholder:text-muted focus:border-accent/60" />
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => onDecide({ decision: 'approve-edits' })} className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-bg hover:brightness-110">{t('chat.planApproveEdits')}</button>
        <button onClick={() => onDecide({ decision: 'approve' })} className="rounded-md border border-accent/50 px-2.5 py-1 text-[11px] text-accent hover:bg-accent-bg">{t('chat.planApprove')}</button>
        <button onClick={() => onDecide({ decision: 'revise', feedback })} className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted hover:text-text">{t('chat.planRevise')}</button>
      </div>
    </div>
  )
}
