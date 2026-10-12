import { autocompletion, closeBrackets, closeBracketsKeymap, completeAnyWord, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, drawSelection, EditorView, gutter, GutterMarker, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, ViewPlugin, WidgetType, type ViewUpdate } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/shared/lib/i18n'
import { Menu } from '../../../shared/components/Menu'
import type { GitMarks } from '@shared/types'
import { languageFor } from '@/features/files/lib/languages'
import { findPanel, openFind } from '../../search/components/searchPanel'

/** Mismos colores de sintaxis que la versión anterior. */
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword], color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: 'var(--syn-type)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--color-muted)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: 'var(--syn-func)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--syn-tag)' },
  { tag: [t.attributeName], color: 'var(--syn-attr)' },
  { tag: [t.meta, t.annotation], color: 'var(--syn-attr)' },
  { tag: [t.heading], color: 'var(--syn-keyword)', fontWeight: '700' },
  { tag: [t.link, t.url], color: 'var(--syn-func)', textDecoration: 'underline' }
])

/** Íconos de Material (rutas de react-icons/md) para el tipo de cada sugerencia, como máscara CSS. */
const maskOf = (path: string): { maskImage: string; WebkitMaskImage: string } => {
  const url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${path}'/></svg>`)}")`
  return { maskImage: url, WebkitMaskImage: url }
}
const CUBE = 'M19 14.87V9.13c0-.72-.38-1.38-1-1.73l-5-2.88c-.31-.18-.65-.27-1-.27s-.69.09-1 .27L6 7.39c-.62.36-1 1.02-1 1.74v5.74c0 .72.38 1.38 1 1.73l5 2.88c.31.18.65.27 1 .27s.69-.09 1-.27l5-2.88c.62-.35 1-1.01 1-1.73m-8 2.3-4-2.3v-4.63l4 2.33zm1-6.33L8.04 8.53 12 6.25l3.96 2.28zm5 4.03-4 2.3v-4.6l4-2.33z'
const TEXT = 'M2.5 4v3h5v12h3V7h5V4zm19 5h-9v3h3v7h3v-7h3z'
const TAG = 'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12z'
const MODULE = 'M14.67 5v6.5H9.33V5zm1 6.5H21V5h-5.33zm-1 7.5v-6.5H9.33V19zm1-6.5V19H21v-6.5zm-7.34 0H3V19h5.33zm0-1V5H3v6.5z'
const SNIPPET = 'M11 14.17 8.83 12 11 9.83 9.59 8.41 6 12l3.59 3.59zM14.41 15.59 18 12l-3.59-3.59L13 9.83 15.17 12 13 14.17z'
/** Como en VS Code: el mismo cubo, con el color según el tipo (azul variables, violeta funciones, naranja clases). */
const ICON_KINDS: Record<string, [string, string]> = {
  variable: [CUBE, '#75beff'], property: [CUBE, '#75beff'], constant: [CUBE, '#75beff'],
  function: [CUBE, '#b180d7'], method: [CUBE, '#b180d7'],
  class: [CUBE, '#ee9d28'], type: [CUBE, '#ee9d28'], interface: [CUBE, '#75beff'], enum: [CUBE, '#ee9d28'],
  namespace: [MODULE, 'var(--color-muted)'], keyword: [TAG, 'var(--color-muted)'], text: [TEXT, 'var(--color-muted)'], snippet: [SNIPPET, 'var(--color-muted)']
}
const completionIcons = Object.fromEntries(Object.entries(ICON_KINDS).map(([kind, [path, color]]) => [`.cm-completionIcon-${kind}`, { ...maskOf(path), backgroundColor: color }]))

/** Marcador de plegado con los chevrones de Material (expand_more / chevron_right) en vez de los caracteres por defecto. */
const foldMarker = (open: boolean): HTMLElement => {
  const el = document.createElement('span')
  el.className = 'tutti-fold'
  el.dataset.open = String(open)
  return el
}
const CHEVRON_DOWN = 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z'
const CHEVRON_RIGHT = 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'

const theme = EditorView.theme({
  '&': { color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', fontSize: 'calc(12.5px * var(--cm-zoom, 1))' },
  '.cm-content': { caretColor: 'var(--color-accent)', padding: '4px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--color-accent-bg) !important' },
  '.cm-activeLine': { backgroundColor: 'var(--ed-line)' },
  '.cm-gutters': { backgroundColor: 'var(--color-surface)', color: 'var(--color-muted)', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-text)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 6px', minWidth: '34px' },
  '.cm-foldGutter': { width: '16px' },
  '.tutti-fold': { display: 'block', width: '16px', height: '16px', backgroundColor: 'currentColor', maskRepeat: 'no-repeat', maskPosition: 'center', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', WebkitMaskSize: 'contain' },
  '.tutti-fold[data-open="true"]': maskOf(CHEVRON_DOWN),
  '.tutti-fold[data-open="false"]': maskOf(CHEVRON_RIGHT),
  '.cm-foldGutter .cm-gutterElement': { padding: '0 2px', color: 'var(--color-muted)', cursor: 'pointer' },
  '.cm-foldGutter .cm-gutterElement:hover': { color: 'var(--color-text)' },
  '.cm-indent-guide': { display: 'inline-block', width: '0', height: '1.35em', borderLeft: '1px solid var(--ed-indent)', verticalAlign: 'middle', pointerEvents: 'none' },
  '.cm-matchingBracket': { backgroundColor: 'var(--ed-bracket)', outline: 'none' },
  '.cm-tooltip': { backgroundColor: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 32px var(--ed-shadow)' },
  '.cm-tooltip-autocomplete ul': { fontFamily: 'var(--font-mono)', fontSize: '12px', maxHeight: '260px' },
  '.cm-tooltip-autocomplete ul li': { padding: '3px 10px', display: 'flex', alignItems: 'center' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-text)' },
  '.cm-completionIcon': { opacity: 1, width: '16px', height: '16px', fontSize: '0', padding: 0, marginRight: '10px', backgroundColor: 'currentColor', maskRepeat: 'no-repeat', maskPosition: 'center', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', WebkitMaskSize: 'contain' },
  '.cm-completionIcon::after': { content: 'none' },
  ...completionIcons,
  '.cm-ext-removed': { backgroundColor: 'color-mix(in srgb, var(--color-danger) 16%, transparent)' },
  '.cm-ext-added': { backgroundColor: 'color-mix(in srgb, var(--color-ok) 16%, transparent)', padding: '0 6px 0 34px', whiteSpace: 'pre-wrap' },
  '.cm-searchMatch': { backgroundColor: 'var(--ed-match)' },
  '.cm-panels': { position: 'absolute', top: '6px', right: '18px', left: 'auto', backgroundColor: 'transparent', border: 'none', pointerEvents: 'none', zIndex: '20' },
  '.cm-panels-top': { border: 'none' },
  '.tutti-find': { pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: '1px', padding: '4px 5px 4px 0', backgroundColor: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: '8px', boxShadow: '0 8px 24px var(--ed-shadow)', fontSize: '11px', color: 'var(--color-text)' },
  '.tutti-find-chevron': { width: '13px', alignSelf: 'stretch', border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '12px', padding: 0 },
  '.tutti-find-chevron:hover': { color: 'var(--color-text)' },
  '.tutti-find-rows': { display: 'flex', flexDirection: 'column', gap: '3px' },
  '.tutti-find-row': { display: 'flex', alignItems: 'center', gap: '2px' },
  '.tutti-find-box': { display: 'flex', alignItems: 'center', gap: '1px', width: '200px', backgroundColor: 'var(--ed-field)', borderRadius: '5px', padding: '0 2px 0 0' },
  '.tutti-find-input': { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-text)', caretColor: 'var(--color-accent)', padding: '3px 6px', font: 'inherit' },
  '.tutti-find-input.invalid': { color: 'var(--color-danger)' },
  '.tutti-find-opt': { height: '17px', minWidth: '17px', border: 'none', borderRadius: '4px', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '0 2px' },
  '.tutti-find-opt:hover': { color: 'var(--color-text)' },
  '.tutti-find-opt.on': { backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)' },
  '.tutti-find-status': { minWidth: '58px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '10px', whiteSpace: 'nowrap' },
  '.tutti-find-status.none': { color: 'var(--color-danger)' },
  '.tutti-find-btn': { height: '20px', minWidth: '20px', border: 'none', borderRadius: '4px', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: '12px', padding: '0 3px' },
  '.tutti-find-btn:hover:not(:disabled)': { backgroundColor: 'var(--color-accent-bg)' },
  '.tutti-find-btn:disabled': { opacity: 0.35, cursor: 'default' },
  '.tutti-find-text': { fontSize: '10px', padding: '0 6px' },
  '.cm-git-gutter': { width: '4px' }
}, { dark: true })

// --- marcas de git en el margen -------------------------------------------------------------------------------------
class MarkerBar extends GutterMarker {
  constructor(readonly color: string) { super() }
  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.style.cssText = `width:3px;height:100%;background:${this.color};border-radius:1px;margin-left:1px`
    return el
  }
  eq(other: MarkerBar): boolean { return other.color === this.color }
}
const COLORS = { added: new MarkerBar('#73c991'), modified: new MarkerBar('#4fa3ff'), deleted: new MarkerBar('#ff6b81') }
const setMarks = StateEffect.define<GitMarks>()
const marksField = StateField.define<GitMarks>({
  create: () => ({}),
  update: (value, tr) => { for (const e of tr.effects) if (e.is(setMarks)) return e.value; return value }
})
const gitGutter = [marksField, gutter({
  class: 'cm-git-gutter',
  lineMarker(view, line) {
    const n = view.state.doc.lineAt(line.from).number
    const kind = view.state.field(marksField)[n]
    return kind ? COLORS[kind] : null
  },
  lineMarkerChange: (update) => update.transactions.some((tr) => tr.effects.some((e) => e.is(setMarks)))
})]

/** Marcas verticales en cada nivel de indentación visible del documento. */
class IndentGuide extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-indent-guide'
    return el
  }
  ignoreEvent(): boolean { return true }
}
const indentGuide = new IndentGuide()
const indentGuides = ViewPlugin.fromClass(class {
  decorations: ReturnType<typeof Decoration.set>
  constructor(view: EditorView) { this.decorations = this.build(view.state) }
  update(update: ViewUpdate): void { if (update.docChanged) this.decorations = this.build(update.state) }
  build(state: EditorState): ReturnType<typeof Decoration.set> {
    const ranges = []
    for (let n = 1; n <= state.doc.lines; n++) {
      const line = state.doc.line(n)
      let column = 0
      let offset = 0
      while (offset < line.length) {
        const char = line.text[offset]
        if (char === ' ') column++
        else if (char === '\t') column += 4 - (column % 4)
        else break
        offset++
        if (column % 4 === 0) ranges.push(Decoration.widget({ widget: indentGuide, side: -1 }).range(line.from + offset))
      }
    }
    return Decoration.set(ranges)
  }
}, { decorations: (value) => value.decorations })

/** Tramo cambiado por otra herramienta: `line` (0-based) y `removed` líneas del texto del editor, y las líneas nuevas que las reemplazarían. */
export interface ExternalChange { line: number; removed: number; added: string[] }

class AddedBlock extends WidgetType {
  constructor(readonly lines: string[]) { super() }
  eq(other: AddedBlock): boolean { return other.lines.join('\n') === this.lines.join('\n') }
  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-ext-added'
    el.textContent = this.lines.join('\n')
    return el
  }
  ignoreEvent(): boolean { return true }
}
const setChanges = StateEffect.define<ExternalChange[]>()
const changesField = StateField.define<ReturnType<typeof Decoration.set>>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setChanges)) {
      const doc = tr.state.doc
      const ranges = []
      for (const c of e.value) {
        const first = Math.min(c.line + 1, doc.lines)
        for (let n = 0; n < c.removed && c.line + 1 + n <= doc.lines; n++) ranges.push(Decoration.line({ class: 'cm-ext-removed' }).range(doc.line(c.line + 1 + n).from))
        if (!c.added.length) continue
        const widget = new AddedBlock(c.added)
        if (c.removed) ranges.push(Decoration.widget({ widget, block: true, side: 1 }).range(doc.line(Math.min(c.line + c.removed, doc.lines)).to))
        else if (c.line >= doc.lines) ranges.push(Decoration.widget({ widget, block: true, side: 1 }).range(doc.length))
        else ranges.push(Decoration.widget({ widget, block: true, side: -1 }).range(doc.line(first).from))
      }
      return Decoration.set(ranges, true)
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field)
})

interface Props {
  path: string
  text: string
  readOnly: boolean
  marks: GitMarks
  changes?: ExternalChange[]
  onChange: (text: string) => void
  onSave: () => void
  focusToken: number
  onSend?: (sel: { startLine: number; endLine: number; text: string }) => void      // «enviar al agente»: la selección, o la línea del cursor si no hay
  reveal?: { path: string; line: number; col: number; length: number; token: number } | null
}

const NO_CHANGES: ExternalChange[] = []

/** Editor de código: guarda el estado de cada archivo (deshacer, cursor) al cambiar de pestaña. */
export function CodeEditor({ path, text, readOnly, marks, changes = NO_CHANGES, onChange, onSave, focusToken, reveal, onSend }: Props) {
  const t = useT()
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const zoom = useRef(1)
  const states = useRef(new Map<string, EditorState>())
  const current = useRef(path)
  const ro = useRef(new Compartment())
  const handlers = useRef({ onChange, onSave, onSend })
  handlers.current = { onChange, onSave, onSend }

  /** La selección con sus líneas (1..n); sin selección, la línea del cursor. */
  const selection = (v: EditorView): { startLine: number; endLine: number; text: string; empty: boolean } => {
    const { from, to } = v.state.selection.main
    const empty = from === to
    const a = v.state.doc.lineAt(from)
    const b = v.state.doc.lineAt(empty ? from : to === v.state.doc.lineAt(to).from && to > from ? to - 1 : to)
    return { startLine: a.number, endLine: b.number, text: empty ? a.text : v.state.sliceDoc(from, to), empty }
  }
  const send = (v: EditorView): boolean => {
    if (!handlers.current.onSend) return false
    const { startLine, endLine, text } = selection(v)
    handlers.current.onSend({ startLine, endLine, text })
    return true
  }
  const changeZoom = (v: EditorView, amount: number): boolean => {
    const next = Math.max(0.8, Math.min(2, zoom.current + amount))
    if (next === zoom.current) return true
    zoom.current = next
    v.dom.style.setProperty('--cm-zoom', String(next))
    return true
  }

  const makeState = (p: string, doc: string, locked: boolean): EditorState => EditorState.create({
    doc,
    extensions: [
      lineNumbers(), foldGutter({ markerDOM: foldMarker }), gitGutter, changesField, indentGuides, highlightActiveLineGutter(), highlightActiveLine(), history(), drawSelection(), indentOnInput(), EditorView.lineWrapping,
      bracketMatching(), closeBrackets(), highlightSelectionMatches(), syntaxHighlighting(highlight), theme,
      autocompletion({ override: undefined, activateOnTyping: true, icons: true }),
      EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]),
      languageFor(p.split(/[\\/]/).pop() ?? p),
      findPanel,
      ro.current.of([EditorState.readOnly.of(locked), EditorView.editable.of(!locked)]),
      keymap.of([
        { key: 'Mod-f', run: (v) => openFind(v, false), scope: 'editor search-panel', preventDefault: true },
        { key: 'Mod-h', run: (v) => openFind(v, true), scope: 'editor search-panel', preventDefault: true },
        { key: 'Mod-+', run: (v) => changeZoom(v, 0.1), preventDefault: true },
        { key: 'Mod-=', run: (v) => changeZoom(v, 0.1), preventDefault: true },
        { key: 'Mod--', run: (v) => changeZoom(v, -0.1), preventDefault: true },
        { key: 'Mod-s', run: () => { handlers.current.onSave(); return true } },
        { key: 'Mod-l', run: send, preventDefault: true },
        ...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab, ...defaultKeymap
      ]),
      EditorView.domEventHandlers({
        contextmenu: (e) => { e.preventDefault(); setMenu(new DOMRect(e.clientX + 190, e.clientY, 0, 0)); return true },
        wheel: (event, v) => {
          if (!(event instanceof WheelEvent) || (!event.ctrlKey && !event.metaKey)) return false
          event.preventDefault()
          return changeZoom(v, event.deltaY < 0 ? 0.1 : -0.1)
        }
      }),
      EditorView.updateListener.of((u) => { if (u.docChanged) handlers.current.onChange(u.state.doc.toString()) })
    ]
  })

  useEffect(() => {
    view.current = new EditorView({ parent: host.current!, state: makeState(path, text, readOnly) })
    view.current.dispatch({ effects: [setMarks.of(marks), setChanges.of(changes)] })
    return () => { view.current?.destroy(); view.current = null }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // cambio de archivo: se guarda el estado del anterior y se recupera (o crea) el del nuevo
  useEffect(() => {
    const v = view.current
    if (!v || current.current === path) return
    states.current.set(current.current, v.state)
    current.current = path
    v.setState(states.current.get(path) ?? makeState(path, text, readOnly))
    v.dispatch({ effects: [setMarks.of(marks), setChanges.of(changes)] })
  }, [path])  // eslint-disable-line react-hooks/exhaustive-deps

  // el texto cambió desde fuera (recarga del disco): se reemplaza sin tocar el historial del usuario más de lo necesario
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== text) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } })
  }, [text])

  useEffect(() => {
    view.current?.dispatch({ effects: ro.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]) })
  }, [readOnly])

  useEffect(() => { view.current?.dispatch({ effects: setMarks.of(marks) }) }, [marks])
  useEffect(() => { view.current?.dispatch({ effects: setChanges.of(changes) }) }, [changes, text])
  // un resultado de búsqueda: el cursor va a la coincidencia y queda seleccionada
  useEffect(() => {
    const v = view.current
    if (!v || !reveal || reveal.path !== path) return
    const line = v.state.doc.line(Math.min(Math.max(reveal.line, 1), v.state.doc.lines))
    const from = Math.min(line.from + reveal.col, line.to)
    v.dispatch({ selection: { anchor: from, head: Math.min(from + reveal.length, line.to) }, effects: EditorView.scrollIntoView(from, { y: 'center' }) })
    v.focus()
  }, [reveal?.token])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (focusToken) view.current?.focus() }, [focusToken])

  const v = view.current
  const hasSelection = !!v && !v.state.selection.main.empty
  const copy = (): void => { if (v) void navigator.clipboard.writeText(v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to)) }
  return (
    <>
      <div ref={host} className="min-h-0 flex-1 overflow-hidden" />
      {menu && v && (
        <Menu anchor={menu} onClose={() => { setMenu(null); v.focus() }} items={[
          { label: hasSelection ? t('ed.sendSelection') : t('ed.sendToAgent'), hidden: !onSend, detail: 'Ctrl+L', onClick: () => send(v) },
          { label: t('term.copy'), separator: true, hidden: !hasSelection, onClick: copy },
          { label: t('ed.cut'), hidden: !hasSelection || readOnly, onClick: () => { copy(); v.dispatch(v.state.replaceSelection('')) } },
          { label: t('term.paste'), hidden: readOnly, onClick: () => { void navigator.clipboard.readText().then((text) => { if (text) v.dispatch(v.state.replaceSelection(text)) }) } },
          { label: t('term.selectAll'), separator: true, onClick: () => v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } }) }
        ]} />
      )}
    </>
  )
}
