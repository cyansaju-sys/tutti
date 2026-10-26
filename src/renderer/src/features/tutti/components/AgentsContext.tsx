import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { MdAutoAwesome, MdChevronRight } from 'react-icons/md'
import type { ContextSource } from '@shared/types'
import type { MsgKey } from '@shared/i18n'
import { confirmAsk } from '@/shared/lib/confirm'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

const BIG_TOKENS = 3000        // a partir de aquí se avisa: cada agente lo lee entero al empezar
const tokensOf = (chars: number): number => Math.ceil(chars / 4)
/** Las plantillas sin tocar: si es lo que hay, se puede generar encima sin preguntar. */
const IS_TEMPLATE = /Lo que escribas aquí lo leen|What you write here is read by|las leen todos los agentes|read by every agent/

/**
 * El contexto del proyecto en la sección de AGENTS.md: un agente lo redacta a partir de un resumen del proyecto y se ve cuántos tokens recibirá cada
 * agente al empezar (y de qué archivos). Solo el del proyecto: se guarda en su AGENTS.md o, si no lo tiene, en .tutti/steering/contexto.md.
 * `version` cambia cuando cambia el AGENTS.md, para volver a contar.
 */
export function AgentsContext({ project, version, onChanged }: { project: string; version: string; onChanged: () => void }) {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const [sources, setSources] = useState<ContextSource[]>([])
  const [show, setShow] = useState(false)
  const [writing, setWriting] = useState('')

  const load = (): Promise<void> => window.api.context.sources(project).then((s) => setSources(s.filter((x) => x.kind !== 'global')))
  useEffect(() => { let live = true; void window.api.context.sources(project).then((s) => { if (live) setSources(s.filter((x) => x.kind !== 'global')) }); return () => { live = false } }, [project, version])
  // al salir se deja de redactar
  useEffect(() => () => { void window.api.ai.cancel('context') }, [])

  const generate = async (): Promise<void> => {
    if (writing) return
    const current = await window.api.context.open(project)
    if (current.text.trim() && !IS_TEMPLATE.test(current.text) && !(await confirmAsk(t('ctx.replace')))) return
    setWriting(t('git.anAgent'))
    const off = window.api.context.onAgent(setWriting)
    const res = await window.api.context.generate(project)
    off()
    setWriting('')
    if (!res.ok && !res.message) { toast(t('ctx.cancelled'), 'info'); return }
    if (!res.ok || !res.text) { toast(res.message || t('ctx.failed'), 'error'); return }
    if (current.file.includes('.tutti')) await window.api.context.init(project, 'steering')      // en .tutti, la primera vez crea la carpeta
    await window.api.fs.write(current.file, res.text, false)
    toast(t('ctx.generated', { agent: res.agent ? t('ctx.with', { agent: res.agent }) : '' }), 'ok')
    void load(); onChanged()
  }

  const total = sources.reduce((n, s) => n + tokensOf(s.chars), 0)
  return (
    <>
      <div className="flex flex-wrap gap-1.5 pt-1.5">
        <button onClick={() => void generate()} disabled={!!writing} title={t('ctx.generateTip')}
          className="flex min-w-0 items-center gap-1.5 rounded-md bg-accent-bg px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:brightness-110 disabled:opacity-60">
          <MdAutoAwesome size={13} className={clsx('shrink-0', writing && 'animate-pulse')} />
          <span className="truncate">{writing ? t('ctx.writingWith', { agent: writing }) : t('ctx.generate')}</span>
        </button>
      </div>
      <div className="mt-1.5 rounded-md border border-line">
        <button onClick={() => setShow((o) => !o)} aria-expanded={show} className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-[11px] text-muted transition-colors hover:text-text">
          <MdChevronRight size={14} className={clsx('shrink-0 transition-transform', show && 'rotate-90')} />
          <span className="min-w-0 flex-1 truncate">{t('ctx.receives')}</span>
          <span className={clsx('shrink-0 font-medium', total > BIG_TOKENS ? 'text-danger' : 'text-accent')}>{t('ctx.tokens', { n: total })}</span>
        </button>
        {show && (
          <div className="border-t border-line px-2 py-1.5">
            {sources.length === 0 && <p className="text-[11px] text-muted">{t('ctx.nothing')}</p>}
            {sources.map((s) => (
              <p key={s.file} title={s.file} className="flex items-center gap-2 py-0.5 text-[11px]">
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {s.mode && <span className="shrink-0 rounded bg-ov/[0.07] px-1.5 py-px text-[9px] font-medium text-muted">{t(`stf.m.${s.mode}` as MsgKey)}{s.delivered === 'index' ? ` · ${t('ctx.listed')}` : ''}</span>}
                <span className="shrink-0 text-muted">{t('ctx.tokens', { n: tokensOf(s.chars) })}</span>
              </p>
            ))}
            {total > BIG_TOKENS && <p className="pt-1 text-[10px] leading-snug text-danger">{t('ctx.big')}</p>}
          </div>
        )}
      </div>
    </>
  )
}
