import { clsx } from 'clsx'
import { useState } from 'react'
import { MdCheck, MdContentCopy } from 'react-icons/md'
import type { ChatTurn, ProjectRef } from '@shared/types'
import { Markdown } from '@/features/files/components/Markdown'
import { iconFor } from '@/shared/lib/icons'
import { useT } from '@/shared/lib/i18n'

/** Lo que citó un mensaje del usuario con «#»: cada referencia con su estado, leído de lo que se adjuntó. */
const attachedChips = (attached?: string): Array<{ token: string; problem: boolean }> =>
  [...(attached ?? '').matchAll(/^--- #(\S+) \((.*)\) ---$/gm)].map((m) => ({ token: m[1], problem: /not attached|truncated|partial/.test(m[2]) }))

/** Los archivos del proyecto que menciona una respuesta (por su ruta o por su nombre, si es único), para abrirlos de un clic. */
export function mentionedFiles(text: string, files: ProjectRef[]): string[] {
  const all = files.filter((f) => !f.isDir).map((f) => f.path)
  const known = new Set(all)
  const byName = new Map<string, string[]>()
  for (const p of all) { const n = p.split('/').pop()!; byName.set(n, [...(byName.get(n) ?? []), p]) }
  const found: string[] = []
  for (const m of text.matchAll(/[\w@.+-]+(?:\/[\w@.+-]+)*\.\w{1,8}/g)) {
    const word = m[0].replace(/^\.\//, '')
    const path = known.has(word) ? word : byName.get(word)?.length === 1 ? byName.get(word)![0] : null
    if (path && !found.includes(path)) found.push(path)
    if (found.length >= 6) break
  }
  return found
}

/** Un mensaje del chat: el del usuario con lo que citó; el del agente en Markdown, con copiar y los archivos que menciona. */
export function ChatMessage({ turn, files, onOpen }: { turn: ChatTurn; files: ProjectRef[]; onOpen: (path: string) => void }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const user = turn.role === 'user'
  const chips = user ? attachedChips(turn.attached) : []
  const mentioned = user ? [] : mentionedFiles(turn.text, files)
  const copy = (): void => { void navigator.clipboard.writeText(turn.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }
  return (
    <div className={clsx('group max-w-[92%] rounded-lg px-3 py-2 text-[12px] leading-relaxed', user ? 'self-end bg-accent-bg' : 'self-start bg-ov/[0.05]')}>
      {user ? <p className="m-0 whitespace-pre-wrap break-words">{turn.text}</p> : <Markdown text={turn.text} />}
      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((c) => <span key={c.token} title={c.token} className={clsx('max-w-full truncate rounded bg-ov/[0.08] px-1.5 py-px text-[10px]', c.problem ? 'text-danger' : 'text-muted')}>#{c.token}</span>)}
        </div>
      )}
      {!user && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {mentioned.map((p) => (
            <button key={p} onClick={() => onOpen(p)} title={p} className="flex max-w-full items-center gap-1 rounded bg-ov/[0.08] px-1.5 py-px text-[10px] text-muted transition-colors hover:text-accent">
              <img src={iconFor(p.split('/').pop() ?? p, false)} alt="" className="size-3 shrink-0" draggable={false} /><span className="truncate">{p.split('/').pop()}</span>
            </button>
          ))}
          <button onClick={copy} title={t('chat.copy')} aria-label={t('chat.copy')} className="ml-auto grid size-5 place-items-center rounded text-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100">
            {copied ? <MdCheck size={13} /> : <MdContentCopy size={12} />}
          </button>
        </div>
      )}
    </div>
  )
}
