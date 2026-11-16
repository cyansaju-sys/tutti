import { clsx } from 'clsx'
import { useState } from 'react'
import { MdCheckCircle, MdChevronRight, MdErrorOutline, MdExpandMore, MdOutlineBuild, MdSmartToy } from 'react-icons/md'
import { Markdown } from '@/features/files/components/Markdown'
import { useT } from '@/lib/i18n'
import type { ChatMessage } from '@/store/chat'
import { ChatThinking } from './ChatThinking'

/** Las herramientas con las que Claude lanza un subagente (`Task` era su nombre antiguo). */
export const isSubagentTool = (m: ChatMessage): boolean => m.role === 'tool' && (m.text === 'Agent' || m.text === 'Task')

const seconds = (ms: number): string => (ms < 60_000 ? `${Math.max(0, Math.round(ms / 1000))} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`)
const tokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

/**
 * Un subagente como en la terminal de Claude Code: su rol y la tarea, una línea con lo último que hizo (herramienta, cuántas lleva, tokens,
 * tiempo) y, al abrirlo, todo lo que hizo por dentro y lo que devolvió.
 */
export function ChatSubagent({ m, all, live }: { m: ChatMessage; all: ChatMessage[]; live: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const inside = all.filter((x) => x.parent === m.toolId)
  const tools = inside.filter((x) => x.role === 'tool')
  const status = m.task?.status ?? (m.result !== undefined ? (m.resultError ? 'failed' : 'completed') : live ? 'running' : 'stopped')
  const count = m.task?.tools || tools.length
  const last = m.task?.last ?? tools[tools.length - 1]?.text
  const label = { running: 'chat.subRunning', completed: 'chat.subDone', failed: 'chat.subFailed', stopped: 'chat.subStopped' }[status] as 'chat.subDone'
  const stats = [last && status === 'running' ? last : '', count ? t('chat.subTools', { n: count }) : '', m.task?.tokens ? `${tokens(m.task.tokens)} tokens` : '', m.task?.ms ? seconds(m.task.ms) : ''].filter(Boolean).join(' · ')

  return (
    <div className="min-w-0 rounded-lg border border-line/70 bg-panel/40 px-2 py-1.5 text-[11px] text-muted">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="no-drag flex w-full min-w-0 items-center gap-1.5 text-left hover:text-text">
        {open ? <MdExpandMore size={13} className="shrink-0" /> : <MdChevronRight size={13} className="shrink-0" />}
        <MdSmartToy size={13} className="shrink-0 text-accent" />
        <span className="shrink-0 font-medium text-text">{m.sub || 'Agent'}</span>
        <span className="min-w-0 flex-1 truncate">{m.detail}</span>
        {status === 'running' && <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" title={t(label)} />}
        {status === 'completed' && <MdCheckCircle size={13} className="shrink-0 text-ok" title={t(label)} />}
        {(status === 'failed' || status === 'stopped') && <MdErrorOutline size={13} className={clsx('shrink-0', status === 'failed' ? 'text-danger' : 'text-muted')} title={t(label)} />}
      </button>
      {stats && <div className="mt-0.5 truncate pl-[19px] text-[10.5px]">⎿ {stats}</div>}
      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5 border-t border-line/60 pt-1.5">
          {m.body && (
            <details className="text-[10.5px]">
              <summary className="cursor-pointer hover:text-text">{t('chat.subPrompt')}</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-line/40 px-2 py-1.5 font-mono leading-snug">{m.body}</pre>
            </details>
          )}
          {inside.map((x) => (isSubagentTool(x)
            ? <ChatSubagent key={x.id} m={x} all={all} live={live} />
            : x.role === 'thinking'
              ? <ChatThinking key={x.id} text={x.text} />
            : x.role === 'tool'
              ? <div key={x.id} className="flex min-w-0 items-center gap-1.5"><MdOutlineBuild size={11} className="shrink-0" /><span className="shrink-0 font-medium">{x.text}</span><span className="truncate">{x.detail}</span>{x.resultError && <span className="shrink-0 text-danger">!</span>}</div>
              : <div key={x.id} className="min-w-0 text-text"><Markdown text={x.text} /></div>))}
          {m.result && <pre className={clsx('max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-line/40 px-2 py-1.5 font-mono text-[10.5px] leading-snug', m.resultError && 'text-danger')}>{m.result}</pre>}
        </div>
      )}
    </div>
  )
}
