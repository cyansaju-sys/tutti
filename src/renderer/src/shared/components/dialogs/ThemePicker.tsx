import { MdBrightnessAuto, MdDarkMode, MdLightMode } from 'react-icons/md'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import { paintTheme, resolveTheme, type ThemePref } from '@/shared/lib/theme'
import { Modal } from '@/shared/components/ui'
import { Palette } from './Palette'
import { Chip, Tag } from './parts'

/** Elegir el tema de color, como se elige un agente: recorrer la lista enseña cada tema sin guardarlo. */
export function ThemePicker() {
  const t = useT()
  const set = useStore((s) => s.set)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const items: ThemePref[] = ['dark', 'light', 'system']
  const icon = { dark: <MdDarkMode size={16} />, light: <MdLightMode size={16} />, system: <MdBrightnessAuto size={16} /> }
  const preview = (pref: ThemePref | undefined): void => { const mode = resolveTheme(pref ?? useStore.getState().theme); paintTheme(mode); set({ themeMode: mode }) }
  return (
    <Modal onClose={() => set({ modal: null })} width={560}>
      <Palette
        placeholder={t('dlg.searchTheme')} items={items} label={(m) => t(`theme.${m}`)} empty={t('dlg.noThemeMatch')} start={items.indexOf(theme)} onActive={preview}
        render={(m, active) => (<><Chip active={active}>{icon[m]}</Chip><span className="flex-1 self-center truncate">{t(`theme.${m}`)}</span>{m === theme && <Tag tone="accent">{t('dlg.current')}</Tag>}</>)}
        onPick={(m) => { if (m) { setTheme(m); set({ modal: null }) } }}
      />
    </Modal>
  )
}
