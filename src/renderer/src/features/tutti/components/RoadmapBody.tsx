import { clsx } from 'clsx'
import { useState } from 'react'
import { MdAdd, MdAutoAwesome, MdCheckCircle, MdChevronRight, MdHelpOutline, MdNoteAdd, MdPlayArrow, MdRadioButtonUnchecked, MdRoute, MdTimelapse } from 'react-icons/md'
import type { MsgKey } from '@shared/i18n'
import type { RoadmapItem, RoadmapState } from '@shared/types'
import { useT } from '@/shared/lib/i18n'
import { iconFor } from '@/shared/lib/icons'
import { useStore } from '@/shared/store'
import { applyPrompt } from '../lib/openspec'
import { draftRoadmapPrompt, phaseProgress, resumePrompt, roadmapTemplate } from '../lib/roadmap'
import { useAskAgent } from '../lib/useAskAgent'

const BUTTON = 'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-1 text-[12px] text-muted transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent'
const ICON_BUTTON = 'grid size-5 shrink-0 place-items-center rounded text-muted opacity-0 transition-all hover:text-accent group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30'
const STATUS = {
  done: { Icon: MdCheckCircle, color: 'text-ok' },
  active: { Icon: MdTimelapse, color: 'text-accent' },
  pending: { Icon: MdRadioButtonUnchecked, color: 'text-muted' },
  unknown: { Icon: MdHelpOutline, color: 'text-warn' }
} as const

/** Crea `.tutti/roadmap.md` con la plantilla y lo abre. */
export async function createRoadmap(project: string, lang: Parameters<typeof roadmapTemplate>[0], openDoc: (path: string) => Promise<void>): Promise<string | null> {
  const dir = await window.api.context.init(project)
  const made = await window.api.fs.create(dir, 'roadmap.md', false)
  if (!made.ok) return made.message
  await window.api.fs.write(made.message, roadmapTemplate(lang), false)
  void openDoc(made.message)
  return null
}

/**
 * El contenido de la sección Roadmap: las fases con su avance (la actual abierta), cada ítem con su estado según su casilla y su cambio de
 * OpenSpec, y el botón «¿Dónde nos quedamos?», que le pide al agente verificar el estado y proponer lo siguiente.
 */
export function RoadmapBody({ state, project, onChanged }: { state: RoadmapState | null; project: string; onChanged: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const openAt = useStore((s) => s.openAt)
  const openSpecForm = useStore((s) => s.openSpecForm)
  const ask = useAskAgent()
  const [toggled, setToggled] = useState<Set<number>>(new Set())          // las fases que el usuario abrió o cerró (por defecto solo la actual está abierta)
  if (!state) return null

  if (!state.exists) {
    const create = async (draft: boolean): Promise<void> => {
      const error = await createRoadmap(project, lang, openDoc)
      if (error) toast(error, 'error')
      else if (draft) await ask.send(draftRoadmapPrompt(lang, '.tutti/roadmap.md'))
      onChanged()
    }
    return (
      <div className="flex flex-col gap-1 px-1 pt-1">
        <p className="px-1 pb-0.5 text-[11px] leading-snug text-muted">{t('rm.what')}</p>
        <button onClick={() => void create(false)} className={BUTTON}><MdAdd size={15} /> {t('rm.create')}</button>
        <button onClick={() => void create(true)} disabled={!ask.selected} title={ask.selected ? t('rm.draftTip') : t('sa.noAgent')} className={clsx(BUTTON, 'disabled:cursor-not-allowed disabled:opacity-40')}><MdAutoAwesome size={14} /> {t('rm.draft')}</button>
      </div>
    )
  }

  const resume = async (): Promise<void> => {
    const who = await ask.send(resumePrompt(lang, state))
    toast(who ? t('rm.resumeSent', { agent: who }) : t('sa.noAgent'), who ? 'ok' : 'error')
  }
  const openItem = (it: RoadmapItem): void => {
    if (it.dir) void openDoc(`${it.dir}/${it.status === 'active' && it.total ? 'tasks.md' : 'proposal.md'}`)
    else void openAt(state.file, it.line, 0, 0)          // sin cambio: su línea en el roadmap
  }
  const isOpen = (pi: number): boolean => (pi === state.current) !== toggled.has(pi)
  const toggle = (pi: number): void => setToggled((s) => { const n = new Set(s); if (!n.delete(pi)) n.add(pi); return n })
  const fileName = state.rel.slice(state.rel.lastIndexOf('/') + 1)

  return (
    <div>
      <div className="flex items-center gap-1 px-1 pb-1">
        <button onClick={() => void openDoc(state.file)} title={state.rel} className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded px-2 pl-4 text-left text-[12px] transition-colors hover:bg-accent-bg">
          <img src={iconFor(fileName, false)} alt="" className="size-4 shrink-0" draggable={false} />
          <span className="min-w-0 flex-1 truncate">{state.rel}</span>
        </button>
        <button onClick={() => void resume()} disabled={!ask.selected} title={ask.selected ? t('rm.resumeTip') : t('sa.noAgent')}
          className="flex shrink-0 items-center gap-1 rounded-md bg-accent-bg px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
          <MdRoute size={13} /> {t('rm.resume')}
        </button>
      </div>
      {state.phases.length === 0 && <p className="px-2 pl-5 text-[11px] text-muted">{t('rm.noPhases')}</p>}
      {state.phases.length > 0 && state.current < 0 && <p className="px-2 pl-5 pb-1 text-[11px] font-medium text-ok">{t('rm.allDone')}</p>}
      <ul>
        {state.phases.map((p, pi) => {
          const { done, total } = phaseProgress(p.items)
          const finished = total > 0 && done === total
          return (
            <li key={`${pi}:${p.title}`}>
              <button onClick={() => toggle(pi)} aria-expanded={isOpen(pi)} className="flex w-full flex-col gap-0.5 rounded px-2 pb-1 pl-3 pt-1 text-left transition-colors hover:bg-accent-bg">
                <span className="flex w-full items-center gap-1 text-[12px]">
                  <MdChevronRight size={14} className={clsx('shrink-0 text-muted transition-transform', isOpen(pi) && 'rotate-90')} />
                  <span className={clsx('min-w-0 flex-1 truncate', pi === state.current ? 'font-semibold' : finished ? 'text-muted' : 'font-medium')}>{p.title}</span>
                  {total > 0 && <span className={clsx('shrink-0 rounded-full px-1.5 text-[9px] font-medium', finished ? 'bg-accent/20 text-accent' : 'bg-ov/[0.07] text-muted')}>{done}/{total}</span>}
                </span>
                {total > 0 && (
                  <span className="ml-[18px] block h-[3px] overflow-hidden rounded-full bg-ov/[0.08]">
                    <span className={clsx('block h-full rounded-full', finished ? 'bg-ok' : 'bg-accent')} style={{ width: `${(done / total) * 100}%` }} />
                  </span>
                )}
              </button>
              {isOpen(pi) && (
                <ul>
                  {p.items.map((it, ii) => {
                    const { Icon, color } = STATUS[it.status]
                    const next = state.next?.phase === pi && state.next.item === ii
                    const tip = t(`rm.st.${it.status}` as MsgKey, { done: it.done, total: it.total })
                    return (
                      <li key={`${it.line}`} className={clsx('group flex h-7 items-center rounded transition-colors hover:bg-accent-bg', next && 'bg-accent-bg/60')}>
                        <button onClick={() => openItem(it)} title={`${tip}${it.change ? ` · ${it.change}` : ''}`} className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 pl-8 text-left text-[12px]">
                          <Icon size={13} className={clsx('shrink-0', color)} aria-label={tip} />
                          <span className={clsx('min-w-0 flex-1 truncate', it.status === 'done' && 'text-muted line-through decoration-ov/30')}>{it.change && it.text !== it.change ? `${it.change} — ${it.text}` : it.text}</span>
                          {next && <span className="shrink-0 rounded bg-accent/20 px-1.5 py-px text-[9px] font-semibold text-accent">{t('rm.next')}</span>}
                          {it.status === 'active' && it.total > 0 && <span className="shrink-0 rounded-full bg-ov/[0.07] px-1.5 text-[9px] font-medium text-muted">{it.done}/{it.total}</span>}
                        </button>
                        {!it.dir && it.status !== 'done' && (
                          <button title={t('rm.newSpec')} onClick={() => openSpecForm({ name: it.change ?? it.text, description: it.change && it.text !== it.change ? it.text : '' })} className={clsx(ICON_BUTTON, 'mr-1')}><MdNoteAdd size={13} /></button>
                        )}
                        {it.status === 'active' && it.change && (
                          <button disabled={!ask.selected} title={ask.selected ? t('os.apply') : t('sa.noAgent')} onClick={() => void ask.send(applyPrompt(lang, it.change!))} className={clsx(ICON_BUTTON, 'mr-1')}><MdPlayArrow size={14} /></button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
