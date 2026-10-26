import { useLayoutEffect, useRef, useState } from 'react'
import { MdSend } from 'react-icons/md'
import { FIELD, Modal } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import type { SpecPrefill } from '@/shared/store/types'
import { useAskAgent } from '../lib/useAskAgent'
import { AgentSelect } from './AgentSelect'
import { changeName, proposePrompt } from '../lib/openspec'

/**
 * Proponer un cambio de OpenSpec: se escribe qué se quiere y se le envía al agente, que crea la carpeta en openspec/changes con la propuesta,
 * las specs, el diseño y las tareas (y no escribe código hasta que lo pidas). `prefill` trae lo que ya sabe el roadmap.
 */
export function SpecDialog({ prefill }: { prefill: SpecPrefill }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const setStore = useStore((s) => s.set)
  const [text, setText] = useState(prefill.description)
  const ask = useAskAgent()
  const agent = ask.selected
  const box = useRef<HTMLTextAreaElement>(null)
  // el campo empieza de una línea y crece con el texto (hasta un tope, y entonces hace scroll)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [text])
  const close = (): void => setStore({ specDialog: null })

  const submit = async (): Promise<void> => {
    if (!text.trim() || !agent || !project) return
    const state = await window.api.openspec.state(project)
    if (!state.initialized) { toast(t('os.notInit'), 'error'); return }
    const name = changeName(text, prefill.name) || 'change'
    await ask.send(proposePrompt(lang, name, text))
    close()
  }

  return (
    <Modal onClose={close} width={520} title={t('sf.title')}>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <p className="text-[11px] leading-snug text-muted">{t('sf.subtitle')}</p>
        <div className="flex items-end gap-2">
          <textarea ref={box} autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={1} spellCheck={false}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }} className={`${FIELD} min-w-0 flex-1 resize-none`} />
          <button onClick={() => void submit()} disabled={!text.trim() || !agent} title={t('sf.create')} aria-label={t('sf.create')}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-bg transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><MdSend size={15} /></button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-[10px] leading-snug text-muted">{agent ? '' : t('sf.noAgent')}</p>
          {agent && <AgentSelect options={ask.options} value={agent} onChange={ask.setPicked} />}
        </div>
      </div>
    </Modal>
  )
}
