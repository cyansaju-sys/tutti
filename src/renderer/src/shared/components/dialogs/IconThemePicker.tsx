import { useT } from '@/renderer/src/shared/lib/i18n'
import { useStore } from '@/renderer/src/shared/store'
import { ICON_FLAVORS, iconFor, type IconFlavor } from '@/renderer/src/shared/lib/icons'
import { Modal } from '@/renderer/src/shared/components/ui'
import { Palette } from './Palette'
import { Chip, Tag } from './parts'

/** Elegir la paleta de los iconos de archivo (las de Catppuccin): cada fila enseña una muestra y recorrerlas las aplica sin guardar. */
export function IconThemePicker() {
  const t = useT()
  const set = useStore((s) => s.set)
  const mode = useStore((s) => s.themeMode)
  const flavor = useStore((s) => s.iconFlavor)
  const setIconFlavor = useStore((s) => s.setIconFlavor)
  const sample = (f: IconFlavor, name: string, dir = false): string => iconFor(name, { dir, mode, flavor: f })?.url ?? ''
  return (
    <Modal onClose={() => set({ modal: null })} width={560}>
      <Palette
        placeholder={t('dlg.searchIconTheme')} items={ICON_FLAVORS} label={(f) => t(`icons.${f}`)} empty={t('dlg.noThemeMatch')} start={ICON_FLAVORS.indexOf(flavor)}
        onActive={(f) => set({ iconPreview: f ?? null })}
        render={(f, active) => (<>
          <Chip active={active}><img src={sample(f, 'src', true)} alt="" className="size-4" draggable={false} /></Chip>
          <span className="flex-1 self-center truncate">{t(`icons.${f}`)}</span>
          <span className="flex shrink-0 items-center gap-1.5 self-center">{['a.ts', 'a.json', 'a.md', 'a.css', 'a.py'].map((n) => <img key={n} src={sample(f, n)} alt="" className="size-4" draggable={false} />)}</span>
          {f === flavor && <Tag tone="accent">{t('dlg.current')}</Tag>}
        </>)}
        onPick={(f) => { if (f) { setIconFlavor(f); set({ modal: null }) } }}
      />
    </Modal>
  )
}
