import { contextBridge, ipcRenderer } from 'electron'
import type { Api, OpenPane, PaneState, PtyExit, UpdateState } from '@/shared/types'

const subscribe = <T extends unknown[]>(channel: string, cb: (...args: T) => void): (() => void) => {
  const handler = (_e: unknown, ...args: unknown[]): void => cb(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: Api = {
  chat: { models: () => ipcRenderer.invoke('chat:models'), commands: (cwd) => ipcRenderer.invoke('chat:commands', cwd), items: (project) => ipcRenderer.invoke('chat:items', project) },
  settings: { get: (k) => ipcRenderer.invoke('settings:get', k), set: (k, v) => ipcRenderer.invoke('settings:set', k, v) },
  theme: { accent: () => ipcRenderer.invoke('theme:accent'), onAccent: (cb) => subscribe<[string | null]>('theme:accent', cb) },
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
    createBranch: (r, n, b, s) => ipcRenderer.invoke('git:createBranch', r, n, b, s), marks: (f) => ipcRenderer.invoke('git:marks', f), worktrees: (r) => ipcRenderer.invoke('git:worktrees', r), addWorktree: (r, b, c, base) => ipcRenderer.invoke('git:addWorktree', r, b, c, base), removeWorktree: (r, p, f) => ipcRenderer.invoke('git:removeWorktree', r, p, f), blame: (f) => ipcRenderer.invoke('git:blame', f), op: (r, o, h, a, m) => ipcRenderer.invoke('git:op', r, o, h, a, m), abortOp: (r) => ipcRenderer.invoke('git:abortOp', r), commitFiles: (r, h, p) => ipcRenderer.invoke('git:commitFiles', r, h, p), log: (r, n) => ipcRenderer.invoke('git:log', r, n), pull: (r) => ipcRenderer.invoke('git:pull', r), fetch: (r) => ipcRenderer.invoke('git:fetch', r), suggestCommit: (r) => ipcRenderer.invoke('git:suggestCommit', r), onCommitAgent: (cb) => subscribe<[string]>('git:commitAgent', cb), show: (r, rev, p) => ipcRenderer.invoke('git:show', r, rev, p)
  },
  ai: { cancel: (kind) => ipcRenderer.invoke('ai:cancel', kind) },
  powers: { list: (project) => ipcRenderer.invoke('powers:list', project), install: (project, source, scope) => ipcRenderer.invoke('powers:install', project, source, scope), remove: (project, name, scope) => ipcRenderer.invoke('powers:remove', project, name, scope), sources: (project) => ipcRenderer.invoke('powers:sources', project), create: (project, draft) => ipcRenderer.invoke('powers:create', project, draft) },
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
    dir: (project) => ipcRenderer.invoke('context:dir', project), steering: (project) => ipcRenderer.invoke('context:steering', project), globalSteeringDir: () => ipcRenderer.invoke('context:global-steering'), working: (project, files) => ipcRenderer.invoke('context:working', project, files), sources: (project) => ipcRenderer.invoke('context:sources', project), init: (project, sub) => ipcRenderer.invoke('context:init', project, sub), open: (project) => ipcRenderer.invoke('context:open', project), ensureGlobal: () => ipcRenderer.invoke('context:ensure-global'), generate: (project) => ipcRenderer.invoke('context:generate', project),
    agents: { state: (project) => ipcRenderer.invoke('context:agents-state', project), write: (project) => ipcRenderer.invoke('context:agents-write', project), remove: (project) => ipcRenderer.invoke('context:agents-remove', project) },
    onAgent: (cb) => subscribe<[string]>('context:agent', cb)
  },
  agents: {
    detect: () => ipcRenderer.invoke('agents:detect'), models: (command, cwd) => ipcRenderer.invoke('agents:models', command, cwd), shell: () => ipcRenderer.invoke('agents:shell'), setShell: (path) => ipcRenderer.invoke('agents:setShell', path),
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
    list: (p) => ipcRenderer.invoke('mcp:list', p), app: () => ipcRenderer.invoke('mcp:app'), add: (a, s, sc, p) => ipcRenderer.invoke('mcp:add', a, s, sc, p),
    probe: (s, p) => ipcRenderer.invoke('mcp:probe', s, p), update: (s, spec, p) => ipcRenderer.invoke('mcp:update', s, spec, p), disable: (s, p) => ipcRenderer.invoke('mcp:disable', s, p), enable: (s, p) => ipcRenderer.invoke('mcp:enable', s, p), remove: (s, p) => ipcRenderer.invoke('mcp:remove', s, p),
    sync: { state: (p, sc) => ipcRenderer.invoke('mcp:sync-state', p, sc), apply: (p, sc) => ipcRenderer.invoke('mcp:sync-apply', p, sc), pull: (p, sc) => ipcRenderer.invoke('mcp:sync-pull', p, sc), standardize: (p) => ipcRenderer.invoke('mcp:sync-standardize', p), resolve: (p, sc, n, a, u) => ipcRenderer.invoke('mcp:sync-resolve', p, sc, n, a, u) }
  },
  orchestra: {
    newId: () => ipcRenderer.invoke('orchestra:newId'),
    tasks: () => ipcRenderer.invoke('orchestra:tasks'),
    clearTasks: () => ipcRenderer.invoke('orchestra:tasks-clear'),
    onOpenPane: (cb) => subscribe<[OpenPane]>('orchestra:open-pane', cb),
    onAttention: (cb) => subscribe<[{ id: string; name: string }]>('orchestra:attention', cb),
    onToast: (cb) => subscribe<[string, 'ok' | 'error' | 'info']>('orchestra:toast', cb),
    paneState: () => ipcRenderer.invoke('orchestra:pane-state'),
    setLeader: (id) => ipcRenderer.invoke('orchestra:set-leader', id),
    runRoles: (project, goal) => ipcRenderer.invoke('orchestra:run-roles', project, goal),
    onPaneState: (cb) => subscribe<[PaneState]>('orchestra:pane-state', cb)
  },
  pty: {
    spawn: (o) => ipcRenderer.invoke('pty:spawn', o),
    write: (id, d) => ipcRenderer.send('pty:write', id, d), paste: (id, text) => ipcRenderer.send('pty:paste', id, text),
    resize: (id, c, r) => ipcRenderer.send('pty:resize', id, c, r),
    kill: (id) => ipcRenderer.send('pty:kill', id),
    foreground: (ids) => ipcRenderer.invoke('pty:foreground', ids),
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
