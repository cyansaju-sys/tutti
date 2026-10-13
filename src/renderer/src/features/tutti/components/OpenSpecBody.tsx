import { clsx } from 'clsx'
import { useState } from 'react'
import { MdAdd, MdArchive, MdChevronRight, MdContentCopy, MdFactCheck, MdPlayArrow, MdSettings } from 'react-icons/md'
import type { OpenSpecChange, OpenSpecState } from '@shared/types'
import { useT } from '@/shared/lib/i18n'
import { iconFor } from '@/shared/lib/icons'
import { useStore } from '@/shared/store'
import { applyPrompt } from '../lib/openspec'
import { useAskAgent } from '../lib/useAskAgent'

export const INSTALL_COMMAND = 'npm install -g @fission-ai/openspec@latest'
const BUTTON = 'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-1 text-[12px] text-muted transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent'
const ICON_BUTTON = 'grid size-5 shrink-0 place-items-center rounded text-muted opacity-0 transition-all hover:text-accent group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30'

/** Los archivos que tiene un cambio, para abrirlos desde su fila. */
const FILES: Array<{ key: keyof Pick<OpenSpecChange, 'hasProposal' | 'hasDesign' | 'hasTasks'>; file: string }> = [
  { key: 'hasProposal', file: 'proposal.md' }, { key: 'hasDesign', file: 'design.md' }, { key: 'hasTasks', file: 'tasks.md' }
]

/**
 * El contenido de la sección Specs (OpenSpec): sin el CLI, el comando para instalarlo; sin `openspec/`, el botón para iniciarlo; y con ella, la
 * configuración, los cambios en marcha (con su avance, y acciones para implementar, validar y archivar) y las specs vigentes.
 */
export function OpenSpecBody({ state, project, onChanged }: { state: OpenSpecState | null; project: string; onChanged: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const toast = useStore((s) => s.toast)
  const openDoc = useStore((s) => s.openDoc)
  const ask = useAskAgent()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  if (!state) return null

  const copy = (): void => { navigator.clipboard.writeText(INSTALL_COMMAND).catch(() => toast(t('fs.copyFailed'), 'error')) }
  const run = async (job: Promise<{ ok: boolean; message: string }>, ok?: string): Promise<void> => {
    setBusy(true)
    const res = await job
    setBusy(false)
    if (!res.ok) toast(res.message, 'error')
    else if (ok) toast(ok, 'ok')
    onChanged()
  }
  const apply = async (name: string): Promise<void> => {
    if (!(await ask.send(applyPrompt(lang, name)))) toast(t('sa.noAgent'), 'error')
  }

  if (!state.initialized) {
    return state.installed ? (
      <div className="px-1 pt-1">
        <p className="px-1 pb-1.5 text-[11px] leading-snug text-muted">{t('os.initHint')}</p>
        <button disabled={busy} onClick={() => void run(window.api.openspec.init(project))} className={BUTTON}><MdAdd size={15} /> {t('os.init')}</button>
      </div>
    ) : <InstallHint onCopy={copy} />
  }

  return (
    <div>
      {!state.installed && <InstallHint onCopy={copy} />}
      <button onClick={() => void openDoc(state.configFile)} title={t('os.configTip')} className="flex h-7 w-full items-center gap-2 rounded px-2 pl-5 text-left text-[12px] transition-colors hover:bg-accent-bg">
        <MdSettings size={15} className="shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t('os.config')}</span>
        {state.schema && <span className="shrink-0 rounded bg-ov/[0.07] px-1.5 py-px text-[9px] font-medium text-muted">{state.schema}</span>}
      </button>

      <h5 className="flex items-center gap-1.5 px-2 pb-0.5 pl-5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {t('os.changes')}{state.archived > 0 && <span className="font-normal normal-case tracking-normal">· {t('os.archivedN', { n: state.archived })}</span>}
      </h5>
      {state.changes.length === 0 && <p className="px-2 pl-5 text-[11px] text-muted">{t('os.noChanges')}</p>}
      <ul>
        {state.changes.map((c) => {
          const finished = c.total > 0 && c.done === c.total
          return (
            <li key={c.name}>
              <div className="group flex h-7 items-center rounded transition-colors hover:bg-accent-bg">
                <button onClick={() => setOpen((s) => { const n = new Set(s); if (!n.delete(c.name)) n.add(c.name); return n })} aria-expanded={open.has(c.name)} className="flex h-full min-w-0 flex-1 items-center gap-1 px-2 pl-3 text-left text-[12px]">
                  <MdChevronRight size={14} className={clsx('shrink-0 text-muted transition-transform', open.has(c.name) && 'rotate-90')} />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  {c.total > 0 && <span className={clsx('shrink-0 rounded-full px-1.5 text-[9px] font-medium', finished ? 'bg-accent/20 text-accent' : 'bg-ov/[0.07] text-muted')}>{c.done}/{c.total}</span>}
                </button>
                <button disabled={!ask.selected} title={ask.selected ? t('os.apply') : t('sa.noAgent')} onClick={() => void apply(c.name)} className={ICON_BUTTON}><MdPlayArrow size={14} /></button>
                <button disabled={busy || !state.installed} title={t('os.validate')} onClick={() => void run(window.api.openspec.validate(project, c.name), t('os.valid', { name: c.name }))} className={ICON_BUTTON}><MdFactCheck size={13} /></button>
                <button disabled={busy || !state.installed || !finished} title={finished ? t('os.archive') : t('os.archiveBlocked')} onClick={() => void run(window.api.openspec.archive(project, c.name), t('os.archivedOk', { name: c.name }))} className={clsx(ICON_BUTTON, 'mr-1')}><MdArchive size={13} /></button>
              </div>
              {open.has(c.name) && (
                <>
                  {FILES.filter((f) => c[f.key]).map((f) => (
                    <button key={f.file} onClick={() => void openDoc(`${c.dir}/${f.file}`)} className="flex h-7 w-full items-center gap-2 rounded px-2 pl-9 text-left text-[12px] transition-colors hover:bg-accent-bg">
                      <img src={iconFor(f.file, false)} alt="" className="size-4 shrink-0" draggable={false} /><span className="truncate">{f.file}</span>
                    </button>
                  ))}
                </>
              )}
            </li>
          )
        })}
      </ul>

      <h5 className="px-2 pb-0.5 pl-5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{t('os.specs')}</h5>
      {state.specs.length === 0 && <p className="px-2 pl-5 text-[11px] text-muted">{t('os.noSpecs')}</p>}
      <ul>
        {state.specs.map((s) => (
          <li key={s.name}>
            <button onClick={() => void openDoc(s.file)} className="flex h-7 w-full items-center gap-2 rounded px-2 pl-5 text-left text-[12px] transition-colors hover:bg-accent-bg">
              <img src={iconFor('spec.md', false)} alt="" className="size-4 shrink-0" draggable={false} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="shrink-0 rounded-full bg-ov/[0.07] px-1.5 text-[9px] font-medium text-muted">{t('os.reqs', { n: s.requirements })}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Sin el CLI de OpenSpec: el comando para instalarlo, con un botón para copiarlo. */
function InstallHint({ onCopy }: { onCopy: () => void }) {
  const t = useT()
  return (
    <div className="mx-1 mb-1.5 rounded-md border border-warn/40 bg-warn/[0.08] px-2.5 py-1.5 text-[11px] leading-snug">
      <p className="m-0 font-medium">{t('os.install')}</p>
      <p className="m-0 mt-0.5 text-muted">{t('os.installHint')}</p>
      <div className="mt-1.5 flex items-center gap-1 rounded bg-ov/[0.07] py-1 pl-2 pr-1">
        <code className="selectable min-w-0 flex-1 break-all font-mono text-[10px]">{INSTALL_COMMAND}</code>
        <button onClick={onCopy} title={t('os.copy')} className="grid size-5 shrink-0 place-items-center rounded text-muted transition-colors hover:text-accent"><MdContentCopy size={13} /></button>
      </div>
    </div>
  )
}
