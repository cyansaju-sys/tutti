import { MdClose } from 'react-icons/md'
import { Markdown } from '@/features/files/components/Markdown'
import { useT } from '@/lib/i18n'
import type { ChatBtw } from '@/store/chat'

/** La respuesta a un /btw: una nota al margen que no se guarda en la conversación; se cierra con la X. */
export function ChatBtwCard({ btw, onClose }: { btw: ChatBtw; onClose: () => void }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel/60 px-2.5 py-2">
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 rounded bg-accent/20 px-1.5 py-px text-[10px] font-semibold text-accent">/btw</span>
        <span className="min-w-0 flex-1 text-[11.5px] text-muted [overflow-wrap:anywhere]">{btw.question}</span>
        <button title={t('chat.btwClose')} onClick={onClose} className="no-drag grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-ov/10 hover:text-text"><MdClose size={13} /></button>
      </div>
      {btw.answer && <div className="min-w-0 text-[12px] [overflow-wrap:anywhere]"><Markdown text={btw.answer} /></div>}
      {btw.error && <div className="text-[11.5px] text-danger [overflow-wrap:anywhere]">{btw.error}</div>}
      {!btw.done && !btw.answer && <div className="text-[11px] text-muted">{t('chat.thinking')}</div>}
      <div className="text-[10px] text-muted/80">{t('chat.btwNote')}</div>
    </div>
  )
}
