import type { MsgKey } from '@/shared/i18n'

/** Un atajo que el usuario puede cambiar. `combo` es el de fábrica, escrito como «Ctrl+Shift+P». */
export interface Command { id: string; combo: string; label: MsgKey }

export const COMMANDS: Command[] = [
  { id: 'save', combo: 'Ctrl+S', label: 'sc.save' },
  { id: 'closeTab', combo: 'Ctrl+W', label: 'sc.closeTab' },
  { id: 'quickOpen', combo: 'Ctrl+E', label: 'sc.quickOpen' },
  { id: 'quickOpenAlt', combo: 'Ctrl+Shift+P', label: 'sc.quickOpen' },
  { id: 'goLine', combo: 'Ctrl+G', label: 'sc.goLine' },
  { id: 'toggleEdit', combo: 'Ctrl+Shift+L', label: 'sc.toggleEdit' },
  { id: 'openAgent', combo: 'Ctrl+Shift+N', label: 'sc.openAgent' },
  { id: 'toggleTerminal', combo: 'Ctrl+Shift+T', label: 'sc.toggleTerminal' },
  { id: 'closePanel', combo: 'Ctrl+Shift+W', label: 'sc.closePanel' },
  { id: 'toggleSidebar', combo: 'Ctrl+Shift+B', label: 'sc.toggleSidebar' },
  { id: 'tab:files', combo: 'Ctrl+Shift+E', label: 'tab.files' },
  { id: 'tab:search', combo: 'Ctrl+Shift+F', label: 'sc.searchProject' },
  { id: 'replaceProject', combo: 'Ctrl+Shift+H', label: 'sc.replaceProject' },
  { id: 'tab:agents', combo: 'Ctrl+Shift+A', label: 'sc.agents' },
  { id: 'tab:git', combo: 'Ctrl+Shift+G', label: 'sc.git' },
  { id: 'tab:tutti', combo: 'Ctrl+Shift+J', label: 'sc.tutti' },
  { id: 'tab:powers', combo: 'Ctrl+Shift+X', label: 'sc.mcp' },
  { id: 'tab:ai', combo: 'Ctrl+Shift+U', label: 'sc.usage' },
  { id: 'quit', combo: 'Ctrl+Q', label: 'sc.quitApp' }
]

/** Atajos que no se pueden asignar: los del editor, el portapapeles y los fijos de la app. */
const RESERVED = new Set(['Ctrl+C', 'Ctrl+V', 'Ctrl+Shift+C', 'Ctrl+Shift+V', 'Shift+Insert', 'Ctrl+F', 'Ctrl+H', 'Ctrl+L', 'Ctrl+Space', 'Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4', 'Ctrl+5', 'Ctrl+6', 'F1', 'Ctrl+PageUp', 'Ctrl+PageDown'])

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'])

/** Mientras se está eligiendo un atajo nuevo, la app no atiende los que ya hay. */
let capturing = false
export const setCapturing = (on: boolean): void => { capturing = on }
export const isCapturing = (): boolean => capturing

/** Las teclas pulsadas como «Ctrl+Shift+P», o null si solo son modificadores. */
export function comboOf(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
  return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', key].filter(Boolean).join('+')
}

/** Un atajo asignable lleva Ctrl o Alt (o es una tecla de función): una letra sola escribiría en el editor. */
export const isAssignable = (combo: string): boolean => /^(Ctrl|Alt)\+/.test(combo) || /^F\d{1,2}$/.test(combo)

export const bindingOf = (id: string, overrides: Record<string, string>): string => overrides[id] ?? COMMANDS.find((c) => c.id === id)?.combo ?? ''

/** El comando al que le toca esta combinación, con los cambios del usuario. */
export const matchCommand = (combo: string, overrides: Record<string, string>): Command | undefined => COMMANDS.find((c) => bindingOf(c.id, overrides) === combo)

/** Por qué no se puede asignar `combo` a `id`: 'reserved', o el comando que ya la usa; null si está libre. */
export function conflictOf(combo: string, id: string, overrides: Record<string, string>): 'reserved' | Command | null {
  if (RESERVED.has(combo)) return 'reserved'
  return COMMANDS.find((c) => c.id !== id && bindingOf(c.id, overrides) === combo) ?? null
}

/** «Ctrl+Shift+P» → «Ctrl + Shift + P», como se muestra. */
export const formatCombo = (combo: string): string => combo.split('+').join(' + ')

/** ¿La app atiende esta tecla? Lo usan las terminales para no quedárselas ellas. */
export function isAppShortcut(e: KeyboardEvent, overrides: Record<string, string>): boolean {
  if (e.key === 'F1' || (e.ctrlKey && !e.shiftKey && (e.key === 'PageUp' || e.key === 'PageDown'))) return true
  const combo = comboOf(e)
  return !!combo && !!matchCommand(combo, overrides)
}
