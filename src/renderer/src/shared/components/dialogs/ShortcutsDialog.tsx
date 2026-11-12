import type { MsgKey } from '@shared/i18n'
import { useT } from '@/shared/lib/i18n'
import { SECTIONS } from '@/shared/lib/shortcuts'
import { useStore } from '@/shared/store'
import { Kbd, Modal } from '@/shared/components/ui'

export function ShortcutsDialog() {
  const t = useT()
  const set = useStore((s) => s.set)
  return (
    <Modal onClose={() => set({ modal: null })} width={560} title={t('dlg.shortcuts')}>
      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
        {SECTIONS.map((section) => (
          <section key={section.title} className="mt-3">
            <h3 className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{t(section.title)}</h3>
            {section.items.map(([keys, what]) => (
              <div key={what} className="flex items-center justify-between gap-4 py-1.5">
                <span className="text-[12px]">{t(what)}</span><Kbd>{keys.startsWith('key.') ? t(keys as MsgKey) : keys}</Kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  )
}
