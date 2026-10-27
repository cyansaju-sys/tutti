import { clsx } from 'clsx'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { MdAdd, MdAutoAwesome, MdDeleteOutline, MdErrorOutline, MdFolderOpen, MdPublic } from 'react-icons/md'
import type { PowerInfo, PowerScope } from '@shared/types'
import { CreatePowerDialog } from '@/features/powers/components/CreatePowerDialog'
import { Modal } from '@/shared/components/ui'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'

const BUTTON = 'flex w-full items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-left text-[12px] transition-colors hover:border-accent hover:bg-accent-bg disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-transparent'
const EMPTY_BUTTON = 'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-1 text-[12px] text-muted transition-colors hover:border-accent hover:bg-accent-bg hover:text-accent'

export interface PowersHandle { add(): void }

/** Los Powers instalados (del proyecto y globales), con papelera para quitarlos; `add()` abre el diálogo de instalar uno desde una carpeta. */
export const PowersView = forwardRef<PowersHandle>(function PowersView(_props, ref) {
  const t = useT()
  const project = useStore((s) => s.project)
  const toast = useStore((s) => s.toast)
  const [powers, setPowers] = useState<PowerInfo[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<PowerInfo | null>(null)
  const [creating, setCreating] = useState<PowerScope | null>(null)          // el diálogo de crear con lo que ya tienes, para ese alcance
  const [fromMine, setFromMine] = useState(false)          // en el diálogo de añadir: se eligió «crear» en vez de «instalar»

  const refresh = useCallback(async () => { setPowers(await window.api.powers.list(project)) }, [project])
  useEffect(() => { void refresh() }, [refresh])
  useImperativeHandle(ref, () => ({ add: () => setAdding(true) }), [])

  const install = async (scope: PowerScope): Promise<void> => {
    setAdding(false)
    if (fromMine) { setFromMine(false); setCreating(scope); return }
    const folder = await window.api.dialog.chooseFolder()
    if (!folder) return
    const res = await window.api.powers.install(project, folder, scope)
    toast(res.ok ? t('powers.installed') : res.message, res.ok ? 'ok' : 'error')
    void refresh()
  }
  const remove = async (power: PowerInfo): Promise<void> => {
    setRemoving(null)
    const res = await window.api.powers.remove(project, power.name, power.scope)
    toast(res.ok ? t('powers.removed', { name: power.name }) : res.message, res.ok ? 'ok' : 'error')
    void refresh()
  }
  const contents = (p: PowerInfo): string => [
    p.mcp.length && `${p.mcp.length} MCP`, p.steering.length && `${p.steering.length} steering`, p.skills.length && `${p.skills.length} skills`, p.hooks.length && `${p.hooks.length} hooks`
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex h-full flex-col overflow-y-auto px-2">
      {powers === null && <p className="px-2 text-[11px] text-muted">{t('powers.reading')}</p>}
      {powers?.length === 0 && <div className="px-1"><button onClick={() => setAdding(true)} className={EMPTY_BUTTON}><MdAdd size={15} /> {t('powers.add')}</button></div>}
      {powers?.map((p) => (
        <div key={`${p.scope}:${p.name}`} className="group flex items-center gap-1 rounded-lg transition-colors hover:bg-accent-bg">
          <div title={p.error ?? p.description} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2">
            {p.error ? <MdErrorOutline size={15} className="shrink-0 text-danger" aria-hidden /> : p.scope === 'global' ? <MdPublic size={15} className="shrink-0 text-accent" aria-hidden /> : <MdFolderOpen size={15} className="shrink-0 text-accent" aria-hidden />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold">{p.name}</span>
              <span className={clsx('block truncate text-[11px]', p.error ? 'text-danger' : 'text-muted')}>{p.error ?? ([t(p.scope === 'global' ? 'powers.global' : 'powers.project'), contents(p)].filter(Boolean).join(' · '))}</span>
            </span>
          </div>
          <button title={t('powers.remove')} onClick={() => setRemoving(p)}
            className="mr-1 grid size-6 shrink-0 place-items-center rounded-md text-muted opacity-0 transition-all hover:bg-danger/15 hover:text-danger group-hover:opacity-100">
            <MdDeleteOutline size={16} />
          </button>
        </div>
      ))}
      {adding && (
        <Modal onClose={() => { setAdding(false); setFromMine(false) }} width={400} title={t(fromMine ? 'powers.createTitle' : 'powers.addTitle')}>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <p className="pb-1 text-[12px] leading-relaxed text-muted">{t(fromMine ? 'powers.createHint' : 'powers.addHint')}</p>
            {!fromMine && <button onClick={() => setFromMine(true)} className={BUTTON}><MdAutoAwesome size={18} className="shrink-0 text-accent" /><span><b className="block font-semibold">{t('powers.fromMine')}</b><span className="text-muted">{t('powers.fromMineHint')}</span></span></button>}
            <button disabled={!project} onClick={() => void install('project')} className={BUTTON}><MdFolderOpen size={18} className="shrink-0 text-accent" /><span><b className="block font-semibold">{t('powers.project')}</b><span className="text-muted">{t(project ? 'powers.projectHint' : 'powers.needProject')}</span></span></button>
            <button onClick={() => void install('global')} className={BUTTON}><MdPublic size={18} className="shrink-0 text-accent" /><span><b className="block font-semibold">{t('powers.global')}</b><span className="text-muted">{t('powers.globalHint')}</span></span></button>
          </div>
        </Modal>
      )}
      {creating && <CreatePowerDialog scope={creating} onClose={() => setCreating(null)} onDone={() => void refresh()} />}
      {removing && (
        <Modal onClose={() => setRemoving(null)} width={400} title={t('powers.removeTitle')}>
          <div className="px-4 pb-4">
            <p className="text-[12px] leading-relaxed text-muted">{t('powers.removeText', { name: removing.name })}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRemoving(null)} className="rounded-lg px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">{t('dlg.cancel')}</button>
              <button onClick={() => void remove(removing)} className="rounded-lg bg-danger/15 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/25">{t('powers.remove')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
})
