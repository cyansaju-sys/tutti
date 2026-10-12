import { clsx } from 'clsx'
import { MdFactCheck, MdPlayArrow, MdPlaylistPlay, MdSync } from 'react-icons/md'
import type { MsgKey } from '@shared/i18n'
import { useT } from '@/shared/lib/i18n'
import { useStore, type Doc } from '@/shared/store'
import { specActions, specContext, type SpecActionId } from '../lib/specActions'
import { useAskAgent } from '../lib/useAskAgent'

const ICON: Record<SpecActionId, JSX.Element> = {
  analyze: <MdFactCheck size={14} />, updateDesign: <MdSync size={14} />, updateTasks: <MdSync size={14} />, runNext: <MdPlayArrow size={14} />, runAll: <MdPlaylistPlay size={14} />
}

/**
 * Lo que se le puede pedir al agente abierto sobre la spec que estás viendo (como las acciones de Kiro): analizar los requisitos, actualizar el
 * diseño y las tareas cuando cambian, y ejecutar las tareas una a una o todas. Aparece en la barra de ruta de los archivos de .tutti/specs.
 */
export function SpecActionsBar({ doc }: { doc: Doc }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const toast = useStore((s) => s.toast)
  const ask = useAskAgent()
  const ctx = specContext(doc.path)
  if (!ctx) return null
  const actions = specActions(lang, ctx, doc.text)
  if (!actions.length) return null
  const agent = ask.selected

  const run = async (prompt: string): Promise<void> => {
    const name = await ask.send(prompt)
    if (name) toast(t('sa.sent', { agent: name }), 'ok')
  }
  return (
    <span className="flex items-center gap-1">
      {actions.map((a) => {
        const off = !agent || a.disabled
        return (
          <button key={a.id} disabled={off} onClick={() => void run(a.prompt)} title={!agent ? t('sa.noAgent') : a.disabled ? t('sa.noTasks') : `${t(`sa.${a.id}.tip` as MsgKey)} (${agent.name}${agent.paneId ? '' : ` · ${t('as.willOpen')}`})`}
            className={clsx('flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors', off ? 'cursor-not-allowed opacity-40' : 'hover:bg-accent-bg hover:text-accent')}>
            {ICON[a.id]} {t(`sa.${a.id}` as MsgKey)}
          </button>
        )
      })}
    </span>
  )
}
