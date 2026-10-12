import { create } from 'zustand'
import { createDocsSlice } from './docs'
import { createPanesSlice } from './panes'
import { createProjectSlice } from './project'
import { createUiSlice } from './ui'
import type { State } from './types'

export { isDirty } from './docs'
export type { Doc, Focus, Modal, Pane, SidebarTab, Toast, ToastKind } from './types'

export const useStore = create<State>((set, get, api) => ({
  ...createProjectSlice(set, get, api),
  ...createDocsSlice(set, get, api),
  ...createPanesSlice(set, get, api),
  ...createUiSlice(set, get, api),
  set: (patch) => set(patch)
}))
