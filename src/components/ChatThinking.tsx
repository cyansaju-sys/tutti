import { useT } from '@/lib/i18n'

/** El razonamiento de Claude: una fila plegada («Razonamiento») que al abrirla enseña el texto; con un punto pulsante mientras lo escribe. */
export function ChatThinking({ text, live = false }: { text: string; live?: boolean }) {
  const t = useT()
  return (
    <details className="group min-w-0 text-[11px] text-muted">
      <summary className="no-drag flex cursor-pointer list-none items-center gap-1.5 hover:text-text [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">›</span>
        <span className="italic">{t('chat.thought')}</span>
        {live && <span className="size-1.5 animate-pulse rounded-full bg-accent" />}
      </summary>
      <div className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-line/40 px-2 py-1.5 text-[10.5px] italic leading-snug [overflow-wrap:anywhere]">{text}</div>
    </details>
  )
}
