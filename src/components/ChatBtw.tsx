import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MdArrowUpward, MdClose, MdDeleteOutline, MdOutlineQuestionAnswer } from 'react-icons/md'
import { Markdown } from '@/features/files/components/Markdown'
import { useT } from '@/lib/i18n'
import type { ChatBtw } from '@/store/chat'

/**
 * «Pregunta al margen» (/btw): una columna al lado del chat con su propio hilo y su caja. Las preguntas no entran en la
 * conversación ni interrumpen la respuesta en curso. La papelera borra el hilo; la X solo oculta el panel.
 */
export function ChatBtwPanel({ btws, fill, onAsk, onClear, onClose }: { btws: ChatBtw[]; fill: boolean; onAsk: (question: string) => void; onClear: () => void; onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }) }, [btws])
  // la caja crece con el texto hasta un tope (después aparece el scroll)
  useLayoutEffect(() => { const el = input.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px` } }, [text])

  const send = (): void => { const q = text.trim(); if (!q) return; onAsk(q); setText('') }
  return (
    <aside onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
      className={`flex flex-col overflow-hidden rounded-lg border border-line bg-panel ${fill ? 'min-w-0 flex-1' : 'w-[340px] shrink-0'}`}>
      <div className="flex h-[28px] shrink-0 items-center gap-1.5 bg-bg pl-2.5 pr-1">
        <MdOutlineQuestionAnswer size={13} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{t('chat.btwTitle')}</span>
        <button title={t('chat.btwClear')} disabled={btws.length === 0} onClick={onClear} className="no-drag grid size-6 place-items-center rounded text-muted hover:bg-ov/10 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"><MdDeleteOutline size={14} /></button>
        <button title={t('chat.btwClose')} onClick={onClose} className="no-drag grid size-6 place-items-center rounded text-muted hover:bg-ov/10 hover:text-text"><MdClose size={14} /></button>
      </div>
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-2.5">
        {btws.length === 0 && <p className="m-0 text-[11.5px] text-muted">{t('chat.btwNote')}</p>}
        {btws.map((b) => (
          <div key={b.id} className="flex flex-col gap-1.5">
            <div className="max-w-full self-start rounded-md border border-line bg-bg px-2 py-1 text-[12px] [overflow-wrap:anywhere]">{b.question}</div>
            {b.answer && <div className="min-w-0 text-[12px] [overflow-wrap:anywhere]"><Markdown text={b.answer} /></div>}
            {b.error && <div className="text-[11.5px] text-danger [overflow-wrap:anywhere]">{b.error}</div>}
            {!b.done && !b.answer && <div className="animate-pulse text-[11px] text-muted">{t('chat.thinking')}</div>}
          </div>
        ))}
      </div>
      <div className="shrink-0 p-2">
        <div className="flex items-end gap-1 rounded-xl border border-accent/40 bg-panel px-2.5 py-2 transition-colors focus-within:border-accent/60">
          <textarea ref={input} rows={2} value={text} spellCheck={false} placeholder={t('chat.btwPlaceholder')} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            className="min-w-0 flex-1 resize-none bg-transparent text-[12px] leading-[1.35] text-text outline-none placeholder:text-muted" />
          <button title={t('chat.send')} disabled={!text.trim()} onClick={send} className="no-drag grid size-[22px] shrink-0 place-items-center rounded-md bg-accent text-bg transition-[filter] hover:brightness-110 disabled:opacity-40"><MdArrowUpward size={14} /></button>
        </div>
      </div>
    </aside>
  )
}
