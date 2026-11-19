import type { MsgKey } from '@/shared/i18n'

export const SECTIONS: Array<{ title: MsgKey; items: Array<[string, MsgKey, string?]> }> = [
  { title: 'sc.files', items: [
    ['Ctrl + S', 'sc.save', 'save'], ['Ctrl + L', 'sc.sendSelection'], ['Ctrl + W', 'sc.closeTab', 'closeTab'],
    ['Ctrl + F', 'sc.find'], ['Ctrl + H', 'sc.replace'], ['Ctrl + E', 'sc.quickOpen', 'quickOpen'], ['Ctrl + Shift + P', 'sc.quickOpen', 'quickOpenAlt'], ['Ctrl + G', 'sc.goLine', 'goLine'],
    ['Ctrl + Shift + L', 'sc.toggleEdit', 'toggleEdit'], ['Tab / Shift + Tab', 'sc.indent'],
    ['key.ctrlSpace', 'sc.complete'], ['↑ ↓ · Enter / Tab · Esc', 'sc.suggest'],
    ['↑ ↓ ← → · Enter · Esc', 'sc.tree']
  ] },
  { title: 'sc.panels', items: [
    ['Ctrl + Shift + N', 'sc.openAgent', 'openAgent'], ['Ctrl + Shift + T', 'sc.toggleTerminal', 'toggleTerminal'],
    ['Ctrl + Shift + W', 'sc.closePanel', 'closePanel'], ['Ctrl + 1 … 6', 'sc.splitView'], ['key.pageNav', 'sc.nextPanel']
  ] },
  { title: 'sc.sidebar', items: [
    ['Ctrl + Shift + B', 'sc.toggleSidebar', 'toggleSidebar'], ['Ctrl + Shift + E', 'tab.files', 'tab:files'], ['Ctrl + Shift + F', 'sc.searchProject', 'tab:search'], ['Ctrl + Shift + H', 'sc.replaceProject', 'replaceProject'], ['Ctrl + Shift + A', 'sc.agents', 'tab:agents'],
    ['Ctrl + Shift + G', 'sc.git', 'tab:git'], ['Ctrl + Shift + K', 'sc.context'], ['Ctrl + Shift + J', 'sc.tutti', 'tab:tutti'], ['Ctrl + Shift + X', 'sc.mcp', 'tab:powers'], ['Ctrl + Shift + U', 'sc.usage', 'tab:ai']
  ] },
  { title: 'sc.general', items: [['Ctrl + C / Ctrl + Shift + C', 'sc.copyTerminal'], ['Ctrl + V / Ctrl + Shift + V / Shift + Insert', 'sc.pasteAlt'], ['Ctrl + Q', 'sc.quitApp', 'quit'], ['F1', 'sc.help']] }
]
