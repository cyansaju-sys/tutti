import { useState } from 'react'
import { MdCheck } from 'react-icons/md'
import { useT } from '@/renderer/src/shared/lib/i18n'
import type { ChatAsk } from '@/renderer/src/shared/store/chat'

/** Las preguntas que Claude le hace al usuario: cada una con sus opciones (una o varias) y una respuesta propia; se envían todas juntas. */
export function ChatQuestions({ ask, onReply }: { ask: ChatAsk; onReply: (answers: Record<string, string> | null) => void }) {
  const t = useT()
  const [picked, setPicked] = useState<Record<string, string[]>>({})          // opciones elegidas por pregunta
  const [tab, setTab] = useState(0)                                         // la pregunta abierta cuando hay varias
  const [own, setOwn] = useState<Record<string, string>>({})                  // respuesta escrita por pregunta

  const toggle = (q: string, label: string, multi: boolean): void =>
    setPicked((p) => {
      const cur = p[q] ?? []
      if (!multi && cur[0] !== label && tab < ask.questions.length - 1) setTimeout(() => setTab((n) => Math.min(n + 1, ask.questions.length - 1)), 150)          // una opción única pasa a la siguiente pregunta
      return { ...p, [q]: multi ? (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]) : cur[0] === label ? [] : [label] }
    })
  const answerOf = (q: string): string => [...(picked[q] ?? []), ...(own[q]?.trim() ? [own[q].trim()] : [])].join(', ')
  const ready = ask.questions.every((q) => answerOf(q.question))
  const send = (): void => onReply(Object.fromEntries(ask.questions.map((q) => [q.question, answerOf(q.question)])))

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent/50 bg-accent-bg px-2.5 py-2.5">
      {ask.questions.length > 1 && (
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line/70 pb-1.5">
          {ask.questions.map((q, i) => (
            <button key={q.question} role="tab" aria-selected={i === tab} onClick={() => setTab(i)}
              className={`no-drag flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${i === tab ? 'bg-panel text-text' : 'text-muted hover:text-text'}`}>
              {answerOf(q.question) && <MdCheck size={11} className="text-accent" />}{q.header}
            </button>
          ))}
        </div>
      )}
      {ask.questions.map((q, i) => i === tab && (
        <div key={q.question} className="flex flex-col gap-1.5">
          {ask.questions.length === 1 && <span className="self-start rounded-full bg-line/60 px-2 py-0.5 text-[10px] text-muted">{q.header}</span>}
          <div className="text-[12px] text-text">{q.question}</div>
          <div className="flex flex-col gap-1">
            {q.options.map((o) => {
              const on = (picked[q.question] ?? []).includes(o.label)
              return (
                <button key={o.label} onClick={() => toggle(q.question, o.label, q.multiSelect)}
                  className={`no-drag flex items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${on ? 'border-accent/70 bg-panel' : 'border-line hover:bg-panel/60'}`}>
                  <span className={`mt-0.5 grid size-3.5 shrink-0 place-items-center border ${q.multiSelect ? 'rounded-[3px]' : 'rounded-full'} ${on ? 'border-accent bg-accent text-bg' : 'border-line'}`}>{on && <MdCheck size={10} />}</span>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-text">{o.label}</span>
                    {o.description && <span className="block text-[10.5px] leading-snug text-muted">{o.description}</span>}
                  </span>
                </button>
              )
            })}
            <input value={own[q.question] ?? ''} onChange={(e) => setOwn((v) => ({ ...v, [q.question]: e.target.value }))} placeholder={t('chat.askOther')}
              className="rounded-md border border-line bg-transparent px-2 py-1.5 text-[11.5px] text-text outline-none placeholder:text-muted focus:border-accent/60" />
          </div>
        </div>
      ))}
      <div className="flex gap-1.5">
        <button onClick={send} disabled={!ready} className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-bg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{t('chat.askSend')}</button>
        <button onClick={() => onReply(null)} className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted hover:text-text">{t('chat.askSkip')}</button>
      </div>
    </div>
  )
}
