import type { StateCreator } from 'zustand'
import { basename } from '@/shared/lib/paths'
import { tr } from './helpers'
import type { Doc } from './types'
import type { State, DocsSlice } from './types'

export const isDirty = (d: Doc): boolean => d.text !== d.savedText

export const createDocsSlice: StateCreator<State, [], [], DocsSlice> = (set, get) => ({
  docs: [], activeDoc: null, reveal: null, specPrefill: null,

  openDoc: async (path) => {
    if (get().docs.some((d) => d.path === path)) { set({ activeDoc: path, focus: 'editor' }); return }
    try {
      const data = await window.api.fs.read(path)
      const doc: Doc = { ...data, path, title: basename(path), savedText: data.text }
      set((s) => ({ docs: [...s.docs, doc], activeDoc: path, focus: 'editor' }))
    } catch (e) {
      get().toast(tr(get, 'store.openFailed', { name: basename(path), error: e instanceof Error ? e.message : String(e) }), 'error')
    }
  },
  openAt: async (path, line, col, length) => {
    await get().openDoc(path)
    if (get().docs.some((d) => d.path === path)) set({ reveal: { path, line, col, length, token: Date.now() } })
  },
  openGraph: () => {
    const path = 'graph:git'
    const doc: Doc = { kind: 'graph', text: '', savedText: '', crlf: false, truncated: false, readOnly: true, mtimeMs: 0, path, title: 'Commits' }
    set((s) => ({ docs: s.docs.some((d) => d.path === path) ? s.docs : [...s.docs, doc], activeDoc: path, focus: 'editor' }))
  },
  openSkillForm: () => {
    const path = 'skill:new'
    const doc: Doc = { kind: 'skillform', text: '', savedText: '', crlf: false, truncated: false, readOnly: true, mtimeMs: 0, path, title: tr(get, 'skf.tabTitle') }
    set((s) => ({ docs: s.docs.some((d) => d.path === path) ? s.docs : [...s.docs, doc], activeDoc: path, focus: 'editor' }))
  },
  openSteeringForm: () => {
    const path = 'steering:new'
    const doc: Doc = { kind: 'steeringform', text: '', savedText: '', crlf: false, truncated: false, readOnly: true, mtimeMs: 0, path, title: tr(get, 'stf.tabTitle') }
    set((s) => ({ docs: s.docs.some((d) => d.path === path) ? s.docs : [...s.docs, doc], activeDoc: path, focus: 'editor' }))
  },
  openSpecForm: (prefill) => {
    const path = 'spec:new'
    if (prefill) set({ specPrefill: prefill })
    const doc: Doc = { kind: 'specform', text: '', savedText: '', crlf: false, truncated: false, readOnly: true, mtimeMs: 0, path, title: tr(get, 'sf.tabTitle') }
    set((s) => ({ docs: s.docs.some((d) => d.path === path) ? s.docs : [...s.docs, doc], activeDoc: path, focus: 'editor' }))
  },
  openHookForm: (edit) => {
    const path = edit ? `hook:edit:${edit.index}:${edit.file}` : 'hook:new'
    const doc: Doc = { kind: 'hookform', text: '', savedText: '', crlf: false, truncated: false, readOnly: true, mtimeMs: 0, path, title: edit ? `${tr(get, 'hf.editTab')}${edit.name ? ` · ${edit.name}` : ''}` : tr(get, 'hf.tabTitle') }
    set((s) => ({ docs: s.docs.some((d) => d.path === path) ? s.docs : [...s.docs, doc], activeDoc: path, focus: 'editor' }))
  },
  openCommitDiff: async (hash, parent, path, label) => {
    const root = get().project
    if (!root) return
    try {
      const before = parent ? ((await window.api.git.show(root, parent, path)) ?? '') : ''
      const after = (await window.api.git.show(root, hash, path)) ?? ''
      const key = `diff:commit:${hash}:${path}`
      const doc: Doc = { kind: 'diff', text: after, savedText: after, original: before, crlf: false, truncated: false, readOnly: true, mtimeMs: 0,
        path: key, title: `${basename(path)} (${hash.slice(0, 7)})`, diffOf: `${root}/${path}`, diffLabel: label }
      set((s) => ({ docs: s.docs.some((d) => d.path === key) ? s.docs : [...s.docs, doc], activeDoc: key, focus: 'editor' }))
    } catch (e) {
      get().toast(tr(get, 'store.compareFailed', { name: basename(path), error: e instanceof Error ? e.message : String(e) }), 'error')
    }
  },
  openDiff: async (file, staged) => {
    const root = get().project
    if (!root) return
    const rel = file.slice(root.length).replace(/^[\\/]+/, '').replace(/\\/g, '/')
    try {
      // preparados: HEAD → lo preparado. Sin preparar: lo preparado (o HEAD) → el archivo en disco.
      const head = await window.api.git.show(root, 'HEAD', rel)
      const index = await window.api.git.show(root, 'index', rel)
      const before = staged ? (head ?? '') : (index ?? head ?? '')
      const after = staged ? (index ?? '') : await window.api.fs.read(file).then((d) => d.text, () => '')
      const path = `diff:${staged ? 'staged' : 'work'}:${file}`
      const doc: Doc = { kind: 'diff', text: after, savedText: after, original: before, crlf: false, truncated: false, readOnly: true, mtimeMs: 0,
        path, title: `${basename(file)} (cambios)`, diffOf: file, diffLabel: staged ? 'Preparado ↔ HEAD' : index !== null ? 'Archivo ↔ preparado' : 'Archivo ↔ HEAD' }
      set((s) => ({ docs: s.docs.some((d) => d.path === path) ? s.docs.map((d) => (d.path === path ? doc : d)) : [...s.docs, doc], activeDoc: path, focus: 'editor' }))
    } catch (e) {
      get().toast(tr(get, 'store.compareFailed', { name: basename(file), error: e instanceof Error ? e.message : String(e) }), 'error')
    }
  },
  closeDoc: (path) => set((s) => {
    const i = s.docs.findIndex((d) => d.path === path)
    const docs = s.docs.filter((d) => d.path !== path)
    const activeDoc = s.activeDoc === path ? (docs[Math.min(i, docs.length - 1)]?.path ?? null) : s.activeDoc
    // sin archivos abiertos, el teclado vuelve al agente activo (si no, el foco se queda en el botón que ya no existe y no se puede escribir)
    return docs.length ? { docs, activeDoc } : { docs, activeDoc, focus: 'pane', paneFocus: s.paneFocus + 1 }
  }),
  renameDocs: (from, to) => set((s) => {
    const move = (p: string): string => (p === from ? to : p.startsWith(from + '/') || p.startsWith(from + '\\') ? to + p.slice(from.length) : p)
    return { docs: s.docs.map((d) => { const path = move(d.path); return path === d.path ? d : { ...d, path, title: path.split(/[\\/]/).pop() ?? d.title } }), activeDoc: s.activeDoc ? move(s.activeDoc) : null }
  }),
  dropDocs: (path) => set((s) => {
    const inside = (p: string): boolean => p === path || p.startsWith(path + '/') || p.startsWith(path + '\\')
    const docs = s.docs.filter((d) => !inside(d.path))
    return { docs, activeDoc: s.activeDoc && inside(s.activeDoc) ? (docs[docs.length - 1]?.path ?? null) : s.activeDoc }
  }),
  updateDocText: (path, text) => set((s) => ({ docs: s.docs.map((d) => (d.path === path ? { ...d, text } : d)) })),
  markSaved: (path, text, mtimeMs) => set((s) => ({ docs: s.docs.map((d) => (d.path === path ? { ...d, savedText: text, mtimeMs } : d)) })),
  markExternalSeen: (path, mtimeMs) => set((s) => ({ docs: s.docs.map((d) => (d.path === path ? { ...d, mtimeMs } : d)) })),
  replaceDoc: (path, data) => set((s) => ({ docs: s.docs.map((d) => (d.path === path ? { ...d, ...data, savedText: data.text } : d)) })),
})
