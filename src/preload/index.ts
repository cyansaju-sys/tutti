import { contextBridge, ipcRenderer } from 'electron'
import type { Api, OpenPane, PaneState, PtyExit, UpdateState } from '../shared/types'

const subscribe = <T extends unknown[]>(channel: string, cb: (...args: T) => void): (() => void) => {
  const handler = (_e: unknown, ...args: unknown[]): void => cb(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: Api = {
  settings: { get: (k) => ipcRenderer.invoke('settings:get', k), set: (k, v) => ipcRenderer.invoke('settings:set', k, v) },
  dialog: { chooseFolder: (start) => ipcRenderer.invoke('dialog:chooseFolder', start) },
  search: { run: (root, opts) => ipcRenderer.invoke('search:run', root, opts), replace: (root, opts, text, paths) => ipcRenderer.invoke('search:replace', root, opts, text, paths) },
  fs: {
    list: (d) => ipcRenderer.invoke('fs:list', d), read: (p) => ipcRenderer.invoke('fs:read', p),
    write: (p, t, c) => ipcRenderer.invoke('fs:write', p, t, c), mtime: (p) => ipcRenderer.invoke('fs:mtime', p),
    create: (d, n, dir) => ipcRenderer.invoke('fs:create', d, n, dir), rename: (p, n) => ipcRenderer.invoke('fs:rename', p, n), move: (p, d) => ipcRenderer.invoke('fs:move', p, d), copy: (p, d) => ipcRenderer.invoke('fs:copy', p, d), trash: (p) => ipcRenderer.invoke('fs:trash', p)
  },
  git: {
    status: (r) => ipcRenderer.invoke('git:status', r), ignored: (r, p) => ipcRenderer.invoke('git:ignored', r, p),
    stage: (r, p) => ipcRenderer.invoke('git:stage', r, p), unstage: (r, p) => ipcRenderer.invoke('git:unstage', r, p), discard: (r, t, u) => ipcRenderer.invoke('git:discard', r, t, u),
    commit: (r, m) => ipcRenderer.invoke('git:commit', r, m), push: (r) => ipcRenderer.invoke('git:push', r),
    branches: (r) => ipcRenderer.invoke('git:branches', r), checkoutDetached: (r, ref) => ipcRenderer.invoke('git:checkout-detached', r, ref), checkout: (r, n, rem) => ipcRenderer.invoke('git:checkout', r, n, rem),
    createBranch: (r, n, b, s) => ipcRenderer.invoke('git:createBranch', r, n, b, s), marks: (f) => ipcRenderer.invoke('git:marks', f), op: (r, o, h, a, m) => ipcRenderer.invoke('git:op', r, o, h, a, m), commitFiles: (r, h, p) => ipcRenderer.invoke('git:commitFiles', r, h, p), log: (r, n) => ipcRenderer.invoke('git:log', r, n), pull: (r) => ipcRenderer.invoke('git:pull', r), fetch: (r) => ipcRenderer.invoke('git:fetch', r), suggestCommit: (r) => ipcRenderer.invoke('git:suggestCommit', r), onCommitAgent: (cb) => subscribe<[string]>('git:commitAgent', cb), show: (r, rev, p) => ipcRenderer.invoke('git:show', r, rev, p)
  },
  ai: { cancel: (kind) => ipcRenderer.invoke('ai:cancel', kind) },
  skills: { import: (project, source) => ipcRenderer.invoke('skills:import', project, source) },
  openspec: {
    state: (p) => ipcRenderer.invoke('openspec:state', p), init: (p) => ipcRenderer.invoke('openspec:init', p),
    validate: (p, c) => ipcRenderer.invoke('openspec:validate', p, c), archive: (p, c) => ipcRenderer.invoke('openspec:archive', p, c)
  },
  roadmap: { state: (p) => ipcRenderer.invoke('roadmap:state', p) },
  hooks: {
    list: (project) => ipcRenderer.invoke('hooks:list', project), trust: (project, on) => ipcRenderer.invoke('hooks:trust', project, on), watch: (project) => ipcRenderer.invoke('hooks:watch', project),
    onRan: (cb) => subscribe<[{ name: string; ok: boolean; message: string }]>('hooks:ran', cb)
  },
  context: {
    steering: (project) => ipcRenderer.invoke('context:steering', project), globalSteeringDir: () => ipcRenderer.invoke('context:global-steering'), working: (project, files) => ipcRenderer.invoke('context:working', project, files), sources: (project) => ipcRenderer.invoke('context:sources', project), init: (project, sub) => ipcRenderer.invoke('context:init', project, sub), open: (project) => ipcRenderer.invoke('context:open', project), ensureGlobal: () => ipcRenderer.invoke('context:ensure-global'), generate: (project) => ipcRenderer.invoke('context:generate', project),
    agents: { state: (project) => ipcRenderer.invoke('context:agents-state', project), write: (project) => ipcRenderer.invoke('context:agents-write', project), remove: (project) => ipcRenderer.invoke('context:agents-remove', project) },
    onAgent: (cb) => subscribe<[string]>('context:agent', cb)
  },
  agents: {
    detect: () => ipcRenderer.invoke('agents:detect'), shell: () => ipcRenderer.invoke('agents:shell'),
    candidates: () => ipcRenderer.invoke('agents:candidates'),
    addCustom: (name, commandLine) => ipcRenderer.invoke('agents:addCustom', name, commandLine),
    removeCustom: (command) => ipcRenderer.invoke('agents:removeCustom', command)
  },
  update: {
    state: () => ipcRenderer.invoke('update:state'), check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'), version: () => ipcRenderer.invoke('update:version'),
    onState: (cb) => subscribe<[UpdateState]>('update:state', cb)
  },
  usage: {
    collect: (p, f) => ipcRenderer.invoke('usage:collect', p, f), rename: (s, n) => ipcRenderer.invoke('usage:rename', s, n),
    remove: (s) => ipcRenderer.invoke('usage:remove', s), names: () => ipcRenderer.invoke('usage:names')
  },
  mcp: {
    list: (p) => ipcRenderer.invoke('mcp:list', p), app: () => ipcRenderer.invoke('mcp:app'), registry: (q, c) => ipcRenderer.invoke('mcp:registry', q, c), featured: () => ipcRenderer.invoke('mcp:featured'), add: (a, s, sc, p) => ipcRenderer.invoke('mcp:add', a, s, sc, p),
    probe: (s, p) => ipcRenderer.invoke('mcp:probe', s, p), update: (s, spec, p) => ipcRenderer.invoke('mcp:update', s, spec, p), disable: (s, p) => ipcRenderer.invoke('mcp:disable', s, p), enable: (s, p) => ipcRenderer.invoke('mcp:enable', s, p), remove: (s, p) => ipcRenderer.invoke('mcp:remove', s, p),
    sync: { state: (p, sc) => ipcRenderer.invoke('mcp:sync-state', p, sc), apply: (p, sc) => ipcRenderer.invoke('mcp:sync-apply', p, sc), pull: (p, sc) => ipcRenderer.invoke('mcp:sync-pull', p, sc), standardize: (p) => ipcRenderer.invoke('mcp:sync-standardize', p), resolve: (p, sc, n, a, u) => ipcRenderer.invoke('mcp:sync-resolve', p, sc, n, a, u) }
  },
  orchestra: {
    newId: () => ipcRenderer.invoke('orchestra:newId'),
    tasks: () => ipcRenderer.invoke('orchestra:tasks'),
    clearTasks: () => ipcRenderer.invoke('orchestra:tasks-clear'),
    approveRoles: (project) => ipcRenderer.invoke('orchestra:roles-approve', project),
    startRoles: (project) => ipcRenderer.invoke('orchestra:roles-start', project),
    roles: (project) => ipcRenderer.invoke('orchestra:roles', project),
    discardRoles: (project) => ipcRenderer.invoke('orchestra:roles-discard', project),
    retryRole: (project, id) => ipcRenderer.invoke('orchestra:roles-retry', project, id),
    addRole: (project, role) => ipcRenderer.invoke('orchestra:roles-add', project, role),
    removeRole: (project, id) => ipcRenderer.invoke('orchestra:roles-remove', project, id),
    roleTemplates: () => ipcRenderer.invoke('orchestra:templates'),
    saveRoleTemplate: (template, previousId) => ipcRenderer.invoke('orchestra:templates-save', template, previousId),
    deleteRoleTemplate: (id) => ipcRenderer.invoke('orchestra:templates-delete', id),
    pauseRoles: (project) => ipcRenderer.invoke('orchestra:roles-pause', project),
    cancelRole: (project, id) => ipcRenderer.invoke('orchestra:roles-cancel', project, id),
    planTemplates: () => ipcRenderer.invoke('orchestra:plan-templates'),
    planFromTemplate: (project, templateId, summary) => ipcRenderer.invoke('orchestra:plan-from-template', project, templateId, summary),
    savePlanTemplate: (project, name) => ipcRenderer.invoke('orchestra:plan-templates-save', project, name),
    deletePlanTemplate: (id) => ipcRenderer.invoke('orchestra:plan-templates-delete', id),
    acceptRole: (project, id) => ipcRenderer.invoke('orchestra:roles-accept', project, id),
    rejectRole: (project, id, feedback) => ipcRenderer.invoke('orchestra:roles-reject', project, id, feedback),
    updateRole: (project, id, edit) => ipcRenderer.invoke('orchestra:roles-update', project, id, edit),
    roleOptions: (project) => ipcRenderer.invoke('orchestra:roles-options', project),
    onOpenPane: (cb) => subscribe<[OpenPane]>('orchestra:open-pane', cb),
    onToast: (cb) => subscribe<[string, 'ok' | 'error' | 'info']>('orchestra:toast', cb),
    paneState: () => ipcRenderer.invoke('orchestra:pane-state'),
    setLeader: (id) => ipcRenderer.invoke('orchestra:set-leader', id),
    onPaneState: (cb) => subscribe<[PaneState]>('orchestra:pane-state', cb)
  },
  pty: {
    spawn: (o) => ipcRenderer.invoke('pty:spawn', o),
    write: (id, d) => ipcRenderer.send('pty:write', id, d), paste: (id, text) => ipcRenderer.send('pty:paste', id, text),
    resize: (id, c, r) => ipcRenderer.send('pty:resize', id, c, r),
    kill: (id) => ipcRenderer.send('pty:kill', id),
    onData: (cb) => subscribe<[string, string]>('pty:data', cb),
    onExit: (cb) => subscribe<[PtyExit]>('pty:exit', cb)
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'), toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    openNew: () => ipcRenderer.send('window:new'), isEmpty: () => ipcRenderer.invoke('window:isEmpty'), startProject: () => ipcRenderer.invoke('window:startProject'),onMaximized: (cb) => subscribe<[boolean]>('window:maximized', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
