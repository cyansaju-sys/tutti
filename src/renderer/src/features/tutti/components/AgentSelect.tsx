import { clsx } from 'clsx'
import { useState } from 'react'
import { MdExpandMore } from 'react-icons/md'
import { Menu } from '@/shared/components/Menu'
import { useT } from '@/shared/lib/i18n'
import type { AgentOption } from '../lib/agentTarget'

/** El agente al que se le pedirá algo: botón con el elegido y un menú con los abiertos y los instalados (estos se abren al enviar). */
export function AgentSelect({ options, value, onChange, className }: { options: AgentOption[]; value: AgentOption | null; onChange: (key: string) => void; className?: string }) {
  const t = useT()
  const [menu, setMenu] = useState<DOMRect | null>(null)
  if (!value) return null
  return (
    <>
      <button type="button" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())} aria-haspopup="menu" aria-expanded={!!menu} title={t('as.title')}
        className={clsx('flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[12px] transition-colors hover:border-accent hover:bg-accent-bg', className)}>
        <span className="font-medium">{value.name}</span>
        <span className="text-[10px] text-muted">{value.paneId ? t('as.open') : t('as.willOpen')}</span>
        <MdExpandMore size={15} className={clsx('shrink-0 text-muted transition-transform', menu && 'rotate-180')} />
      </button>
      {menu && (
        <Menu anchor={menu} width={260} onClose={() => setMenu(null)}
          items={options.map((o) => ({ label: o.name, detail: o.paneId ? t('as.open') : t('as.willOpen'), checked: o.key === value.key, onClick: () => onChange(o.key) }))} />
      )}
    </>
  )
}
