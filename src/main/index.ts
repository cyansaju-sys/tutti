import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { addCustomAgent, candidateExecutables, defaultShell, detectAgents, removeCustomAgent, setShell } from './services/agents/agents'
import { agentsPointerState, removeAgentsPointer, writeAgentsPointer } from './services/context/agentsPointer'
import { ensureGlobalContext, contextSources, ensureGlobalSteeringDir, ensureProjectDir, globalSteeringDir, openProjectContext, setWorkingFiles } from './services/context/context'
import { generateContext } from './services/context/contextGen'
import { chatAgents, chatAsk } from './services/chat'
import { listRefs, previewRefs } from './services/refs'
import { listRefs as listExtraRefs } from './services/chatRefs'
import { slashCommands } from './services/slash'
import { suggestCommit } from './services/git/commitMessage'
import { archiveOpenspec, initOpenspec, openspecState, validateOpenspec } from './services/openspec'
import { markRoadmapDone, roadmapState } from './services/roadmap'
import { copyEntry, createEntry, listDir, moveEntry, mtime, renameEntry, readFileData, writeFileData } from './services/files'
import * as git from './services/git/git'
import * as pty from './services/agents/pty'
import { loadSteering } from './services/context/steering'
import { createPower, installPower, listPowers, powerSources, removePower } from './services/powers'
import { importSkill } from './services/skills'
import { isTrusted, loadHooks, setTrusted, startHooks, stopHooks } from './services/hooks'
import { tm } from './utils/i18n'
import { getSetting, migrateLegacyConfig, setSetting } from './services/settings'
import { replaceInFiles, searchFiles } from './services/search'
import type { ChatOptions, ChatTurn, GitOp, PowerDraft, PowerScope, PtyOptions, RoleEdit, RoleTemplate, SearchOptions, StartProject } from '../shared/types'
import { runCapture } from '../../test/capture'
import { checkForUpdates, installUpdate, setupUpdater, stopUpdater, updateState } from './services/updater'
import * as mcp from './services/mcp/mcp'
import { asServer, listDisabled } from './services/mcp/disabled'
import { disableServer, enableServer, probeServer, updateServer, deleteServer } from './services/mcp/manage'
import { applySync, pullSync, resolveSync, standardizeProject, syncState } from './services/mcp/sync'
import { collectUsage, deleteSession, renameSession, sessionNames } from './services/usage/usage'
import { runSelfTest } from './utils/selftest'
import { ensureLauncher } from './services/cli'
import { acceptRole, addRole, cancelRole, deletePlanTemplate, pauseRoles, planFromTemplate, planTemplates, saveAsPlanTemplate, appMcpInfo, deleteRoleTemplate, removeRole, roleTemplates, saveRoleTemplate, approveRoles, rejectRole, clearTasks, discardRoles, newId, paneState, retryRole, setLeader, roleOptions, rolesState, startHub, startRoles, stopHub, taskList, updateRole } from './services/agents/hub'

if (process.argv.includes('--tutti-version')) { console.log(app.getVersion()); app.exit(0) }      // para comprobar qué versión es un AppImage
if (process.env.APPIMAGE) app.commandLine.appendSwitch('no-sandbox')     // un AppImage no puede dejar chrome-sandbox con permisos especiales

let win: BrowserWindow | null = null
const emptyWindow = process.argv.includes('--new-window')      // ventana nueva: arranca sin abrir el último proyecto

/** El repositorio git que contiene `dir` (la carpeta con `.git` más cercana hacia arriba), o `dir` si no está en ninguno. */
function repoRoot(dir: string): string {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d
    if (dirname(d) === d) return dir
  }
}

/**
 * Ruta pasada en la línea de comandos: una carpeta (`tutti .`, `tutti ~/proyecto`) se abre como proyecto; un archivo
 * (`tutti src/main.ts`) abre su repositorio (o su carpeta) y el archivo en el editor.
 */
function projectFromArgs(): StartProject | null {
  const [arg] = process.argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-'))      // en desarrollo argv[1] es la ruta de la app
  if (!arg) return null
  const path = resolve(process.env.OWD || process.cwd(), arg)          // un AppImage deja en OWD la carpeta desde la que se lanzó
  try {
    const st = statSync(path)
    if (st.isDirectory()) return { project: path, file: null }
    if (st.isFile()) return { project: repoRoot(dirname(path)), file: path }
  } catch { /* no existe */ }
  console.error(`tutti: no existe ${path}`)
  return null
}
const startProject = projectFromArgs()

/** Otra ventana de Tutti es otro proceso: cada una tiene sus agentes, su servidor de tareas y su proyecto. */
function openNewWindow(): void {
  const exe = app.isPackaged ? process.env.APPIMAGE || process.execPath : process.execPath      // en desarrollo nunca el AppImage instalado
  const args = app.isPackaged ? ['--new-window'] : [app.getAppPath(), '--new-window']
  spawn(exe, args, { detached: true, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } }).unref()
}

/** Posición de una ventana de ese tamaño, centrada en la pantalla donde está el cursor (con varios monitores, ahí es donde se mira al abrir la app). */
function centeredOnCursor(width: number, height: number): { x: number; y: number; width: number; height: number } {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const w = Math.min(width, workArea.width), h = Math.min(height, workArea.height)
  return { x: Math.round(workArea.x + (workArea.width - w) / 2), y: Math.round(workArea.y + (workArea.height - h) / 2), width: w, height: h }
}

function createWindow(): void {
  win = new BrowserWindow({
    ...(process.env.TUTTI_CAPTURE ? { width: 1360, height: 860 } : centeredOnCursor(1360, 860)), minWidth: 900, minHeight: 560, show: false, frame: false, backgroundColor: '#07080C',
    title: 'Tutti', icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, contextIsolation: true }
  })
  win.once('ready-to-show', () => win?.show())
  if (process.env.TUTTI_CAPTURE) {
    win.webContents.once('did-finish-load', () => void runCapture(win!, process.env.TUTTI_CAPTURE!, process.cwd()))
  }
  win.on('maximize', () => win?.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win?.webContents.send('window:maximized', false))
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } }) // enlaces fuera de la app
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

/** Tareas de IA en curso (mensaje de commit, contexto): se pueden cancelar al salir de su apartado. */
const tasks = new Map<'commit' | 'context' | 'chat', AbortController>()
async function withTask<T>(kind: 'commit' | 'context' | 'chat', run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  tasks.get(kind)?.abort()
  const controller = new AbortController()
  tasks.set(kind, controller)
  try { return await run(controller.signal) } finally { if (tasks.get(kind) === controller) tasks.delete(kind) }
}

function registerIpc(): void {
  ipcMain.handle('settings:get', (_e, key: string) => getSetting(key))
  ipcMain.handle('settings:set', (_e, key: string, value: unknown) => setSetting(key, value))
  ipcMain.handle('dialog:chooseFolder', async (_e, start?: string) => {
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory'], defaultPath: start, title: tm('m.dlg.openProject') })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle('context:generate', (e, project: string) => withTask('context', (signal) => generateContext(project, (name) => e.sender.send('context:agent', name), signal)))
  ipcMain.handle('ai:cancel', (_e, kind: 'commit' | 'context' | 'chat') => tasks.get(kind)?.abort())
  ipcMain.handle('chat:agents', () => chatAgents())
  ipcMain.handle('chat:refs', (_e, project: string) => listRefs(project))
  ipcMain.handle('chat:extra-refs', (_e, project: string) => listExtraRefs(project))
  ipcMain.handle('chat:slash', (_e, project: string | null, command: string) => slashCommands(project, command))
  ipcMain.handle('chat:ask', (e, project: string | null, command: string, history: ChatTurn[], options?: ChatOptions) => withTask('chat', (signal) => chatAsk(project, command, history, signal, (text) => e.sender.send('chat:chunk', text), options)))
  ipcMain.handle('chat:preview', (_e, project: string, text: string, inline: Record<string, string>) => previewRefs(project, text, inline ?? {}))
  // hooks de .tutti/hooks: se vigilan solo en proyectos autorizados; sus avisos llegan a la interfaz
  const hooksHost = {
    notify: (r: { name: string; ok: boolean; message: string }): void => { win?.webContents.send('hooks:ran', r) },
    sendToAgent: (prompt: string): boolean => {
      const leader = pty.agentSessions().filter((a) => !a.parentId).at(-1)          // el agente principal más reciente
      if (!leader) return false
      pty.sendPrompt(leader.id, prompt); return true
    }
  }
  ipcMain.handle('openspec:state', (_e, project: string) => openspecState(project))
  ipcMain.handle('openspec:init', (_e, project: string) => initOpenspec(project))
  ipcMain.handle('openspec:validate', (_e, project: string, change?: string) => validateOpenspec(project, change))
  ipcMain.handle('openspec:archive', async (_e, project: string, change: string) => {
    const res = await archiveOpenspec(project, change)
    if (res.ok) markRoadmapDone(project, change)          // el ítem del roadmap que lo nombra queda hecho
    return res
  })
  ipcMain.handle('roadmap:state', (_e, project: string) => roadmapState(project))
  ipcMain.handle('hooks:list', (_e, project: string) => ({ hooks: loadHooks(project), trusted: isTrusted(project) }))
  ipcMain.handle('hooks:trust', (_e, project: string, on: boolean) => { setTrusted(project, on); if (on) startHooks(project, hooksHost); else stopHooks() })
  ipcMain.handle('hooks:watch', (_e, project: string | null) => { if (process.env.TUTTI_CAPTURE) return; if (project) startHooks(project, hooksHost); else stopHooks() })
  ipcMain.handle('context:init', (_e, project: string, sub?: string) => (process.env.TUTTI_CAPTURE ? join(project, '.tutti', sub ?? '') : ensureProjectDir(project, sub)))      // en las capturas no se escribe en el proyecto fotografiado
  ipcMain.handle('context:steering', (_e, project: string) => loadSteering(project, { globalDir: globalSteeringDir() }).map(({ body: _body, ...info }) => info))
  ipcMain.handle('powers:list', (_e, project: string | null) => listPowers(project))
  ipcMain.handle('powers:install', (_e, project: string | null, source: string, scope: PowerScope) => installPower(project, source, scope))
  ipcMain.handle('powers:sources', (_e, project: string | null) => powerSources(project))
  ipcMain.handle('powers:create', (_e, project: string | null, draft: PowerDraft) => createPower(project, draft))
  ipcMain.handle('powers:remove', (_e, project: string | null, name: string, scope: PowerScope) => removePower(project, name, scope))
  ipcMain.handle('skills:import', (_e, project: string, source: string) => importSkill(project, source))
  ipcMain.handle('context:global-steering', () => ensureGlobalSteeringDir())
  ipcMain.handle('context:working', (_e, project: string, files: string[]) => setWorkingFiles(project, files))
  ipcMain.handle('context:sources', (_e, project: string) => contextSources(project))
  ipcMain.handle('context:open', (_e, project: string) => openProjectContext(project))
  ipcMain.handle('context:agents-state', (_e, project: string) => agentsPointerState(project))
  ipcMain.handle('context:agents-write', (_e, project: string) => (process.env.TUTTI_CAPTURE ? { ok: true, message: join(project, 'AGENTS.md') } : writeAgentsPointer(project)))      // en las capturas no se escribe en el proyecto fotografiado
  ipcMain.handle('context:agents-remove', (_e, project: string) => removeAgentsPointer(project))
  ipcMain.handle('context:ensure-global', () => ensureGlobalContext())
  ipcMain.handle('fs:list', (_e, dir: string) => listDir(dir))
  ipcMain.handle('search:run', (_e, root: string, opts: SearchOptions) => searchFiles(root, opts))
  ipcMain.handle('search:replace', (_e, root: string, opts: SearchOptions, text: string, paths: string[]) => replaceInFiles(root, opts, text, paths))
  ipcMain.handle('fs:read', (_e, path: string) => readFileData(path))
  ipcMain.handle('fs:write', (_e, path: string, text: string, crlf: boolean) => writeFileData(path, text, crlf))
  ipcMain.handle('fs:create', (_e, dir: string, name: string, isDir: boolean) => createEntry(dir, name, isDir))
  ipcMain.handle('fs:move', (_e, path: string, dir: string) => moveEntry(path, dir))
  ipcMain.handle('fs:copy', (_e, path: string, dir: string) => copyEntry(path, dir))
  ipcMain.handle('fs:rename', (_e, path: string, name: string) => renameEntry(path, name))
  ipcMain.handle('fs:trash', async (_e, path: string) => {         // a la papelera: se puede recuperar
    try { await shell.trashItem(path); return { ok: true, message: tm('m.trash') } } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) } }
  })
  ipcMain.handle('fs:mtime', (_e, path: string) => mtime(path))

  ipcMain.handle('git:status', (_e, root: string) => git.status(root))
  ipcMain.handle('git:ignored', (_e, root: string, paths: string[]) => git.ignored(root, paths))
  ipcMain.handle('git:stage', (_e, root: string, paths: string[]) => git.stage(root, paths))
  ipcMain.handle('git:unstage', (_e, root: string, paths: string[]) => git.unstage(root, paths))
  // descartar: los archivos conocidos vuelven a su versión; los nuevos (sin seguimiento) van a la papelera para poder recuperarlos (si no hay papelera, p. ej. en un disco externo, se borran)
  ipcMain.handle('git:discard', async (_e, root: string, tracked: string[], untracked: string[]): Promise<string> => {
    const inside = (rel: string): string | null => { const abs = resolve(root, rel); return abs !== resolve(root) && abs.startsWith(resolve(root) + sep) ? abs : null }
    if ([...tracked, ...untracked].some((p) => !inside(p))) return tm('m.git.badPath')
    const error = await git.discardTracked(root, tracked)
    if (error) return error
    for (const rel of untracked) {
      try { await shell.trashItem(inside(rel)!) } catch {
        try { await rm(inside(rel)!, { recursive: true, force: true }) } catch (e) { return e instanceof Error ? e.message : String(e) }
      }
    }
    return ''
  })
  ipcMain.handle('git:commit', (_e, root: string, message: string) => git.commit(root, message))
  ipcMain.handle('git:push', (_e, root: string) => git.push(root))
  ipcMain.handle('git:branches', (_e, root: string) => git.branches(root))
  ipcMain.handle('git:checkout-detached', (_e, root: string, ref: string) => git.checkoutDetached(root, ref))
  ipcMain.handle('git:checkout', (_e, root: string, name: string, remote: boolean) => git.checkout(root, name, remote))
  ipcMain.handle('git:createBranch', (_e, root: string, name: string, base?: string, switchTo?: boolean) => git.createBranch(root, name, base, switchTo))
  ipcMain.handle('git:show', (_e, root: string, rev: string, path: string) => git.show(root, rev, path))
  ipcMain.handle('git:op', (_e, root: string, op: GitOp, hash: string, arg?: string, isMerge?: boolean) => git.commitOp(root, op, hash, arg, isMerge))
  ipcMain.handle('git:commitFiles', (_e, root: string, hash: string, parent: string | null) => git.commitFiles(root, hash, parent))
  ipcMain.handle('git:log', (_e, root: string, limit: number) => git.log(root, limit))
  ipcMain.handle('git:pull', (_e, root: string) => git.pull(root))
  ipcMain.handle('git:fetch', (_e, root: string) => git.fetch(root))
  ipcMain.handle('git:suggestCommit', (e, root: string) => withTask('commit', (signal) => suggestCommit(root, (name) => e.sender.send('git:commitAgent', name), signal)))
  ipcMain.handle('git:marks', (_e, file: string) => git.marks(file))

  ipcMain.handle('mcp:list', (_e, project: string | null) => {
    const live = mcp.listServers(project)
    const off = listDisabled(project).filter((e) => !live.some((s) => s.agent === e.agent && s.scope === e.scope && s.name.toLowerCase() === e.name.toLowerCase())).map(asServer)
    return [...live, ...off]
  })
  ipcMain.handle('mcp:probe', (_e, server, project) => probeServer(server, project))
  ipcMain.handle('mcp:update', (_e, server, spec, project) => updateServer(server, spec, project))
  ipcMain.handle('mcp:disable', (_e, server, project) => disableServer(server, project))
  ipcMain.handle('mcp:enable', (_e, server, project) => enableServer(server, project))
  ipcMain.handle('mcp:remove', (_e, server, project) => deleteServer(server, project))
  ipcMain.handle('mcp:sync-state', (_e, project, scope) => syncState(project, scope))
  ipcMain.handle('mcp:sync-apply', (_e, project, scope) => applySync(project, scope))
  ipcMain.handle('mcp:sync-standardize', (_e, project) => standardizeProject(project))
  ipcMain.handle('mcp:sync-pull', (_e, project, scope) => pullSync(project, scope))
  ipcMain.handle('mcp:sync-resolve', (_e, project, scope, name, agent, use) => resolveSync(project, scope, name, agent, use))
  ipcMain.handle('mcp:app', () => appMcpInfo())
  ipcMain.handle('mcp:add', (_e, agent, spec, scope, project) => mcp.addServer(agent, spec, scope, project))
  ipcMain.handle('usage:collect', (_e, project: string | null, fetchLimits: boolean) => collectUsage(detectAgents(), project, fetchLimits && !process.env.TUTTI_NO_LIMITS_FETCH))   // TUTTI_NO_LIMITS_FETCH: pruebas sin red
  ipcMain.handle('usage:rename', (_e, session, name: string) => renameSession(session, name))
  ipcMain.handle('usage:remove', (_e, session) => deleteSession(session))
  ipcMain.handle('usage:names', () => sessionNames())
  ipcMain.handle('update:state', () => updateState())
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', () => installUpdate())
  ipcMain.handle('update:version', () => app.getVersion())
  ipcMain.handle('orchestra:newId', () => newId())
  ipcMain.handle('orchestra:tasks', () => taskList())
  ipcMain.handle('orchestra:tasks-clear', () => clearTasks())
  ipcMain.handle('orchestra:roles-approve', (_e, project: string) => approveRoles(project))
  ipcMain.handle('orchestra:roles-start', (_e, project: string) => startRoles(project))
  ipcMain.handle('orchestra:roles', (_e, project: string) => rolesState(project))
  ipcMain.handle('orchestra:roles-discard', (_e, project: string) => discardRoles(project))
  ipcMain.handle('orchestra:roles-retry', (_e, project: string, id: string) => retryRole(project, id))
  ipcMain.handle('orchestra:pane-state', () => paneState())
  ipcMain.handle('orchestra:set-leader', (_e, id: string) => setLeader(id))
  ipcMain.handle('orchestra:roles-add', (_e, project: string, role: RoleEdit & { id?: string; template?: string }) => addRole(project, role))
  ipcMain.handle('orchestra:roles-remove', (_e, project: string, id: string) => removeRole(project, id))
  ipcMain.handle('orchestra:templates', () => roleTemplates())
  ipcMain.handle('orchestra:templates-save', (_e, template: Partial<RoleTemplate>, previousId?: string) => { const { ok, errors } = saveRoleTemplate(template, previousId); return { ok, errors } })
  ipcMain.handle('orchestra:templates-delete', (_e, id: string) => deleteRoleTemplate(id))
  ipcMain.handle('orchestra:roles-pause', (_e, project: string) => pauseRoles(project))
  ipcMain.handle('orchestra:roles-cancel', (_e, project: string, id: string) => cancelRole(project, id))
  ipcMain.handle('orchestra:plan-templates', () => planTemplates())
  ipcMain.handle('orchestra:plan-from-template', (_e, project: string, id: string, summary: string) => planFromTemplate(project, id, summary))
  ipcMain.handle('orchestra:plan-templates-save', (_e, project: string, name: string) => saveAsPlanTemplate(project, name))
  ipcMain.handle('orchestra:plan-templates-delete', (_e, id: string) => deletePlanTemplate(id))
  ipcMain.handle('orchestra:roles-accept', (_e, project: string, id: string) => acceptRole(project, id))
  ipcMain.handle('orchestra:roles-reject', (_e, project: string, id: string, feedback: string) => rejectRole(project, id, feedback))
  ipcMain.handle('orchestra:roles-update', (_e, project: string, id: string, edit: RoleEdit) => updateRole(project, id, edit))
  ipcMain.handle('orchestra:roles-options', (_e, project: string) => roleOptions(project))
  ipcMain.handle('agents:detect', () => detectAgents())
  ipcMain.handle('agents:shell', () => defaultShell())
  ipcMain.handle('agents:setShell', (_e, path: string) => setShell(path))
  ipcMain.handle('agents:candidates', () => candidateExecutables())
  ipcMain.handle('agents:addCustom', (_e, name: string, commandLine: string) => addCustomAgent(name, commandLine))
  ipcMain.handle('agents:removeCustom', (_e, command: string) => removeCustomAgent(command))

  ipcMain.handle('pty:spawn', (e, opts: PtyOptions) => pty.spawn(e.sender, opts))
  ipcMain.on('pty:paste', (_e, id: string, text: string) => pty.pastePrompt(id, String(text).slice(0, 60_000)))
  ipcMain.on('pty:write', (_e, id: string, data: string) => pty.write(id, data))
  ipcMain.on('pty:resize', (_e, id: string, cols: number, rows: number) => pty.resize(id, cols, rows))
  ipcMain.on('pty:kill', (_e, id: string) => pty.kill(id))

  ipcMain.on('window:minimize', () => win?.minimize())
  ipcMain.on('window:toggleMaximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
  ipcMain.on('window:close', () => win?.close())
  ipcMain.on('window:new', openNewWindow)
  ipcMain.handle('window:isEmpty', () => emptyWindow)
  ipcMain.handle('window:startProject', () => startProject)
}

if (process.env.TUTTI_CAPTURE) app.setPath('appData', join(app.getPath('temp'), `tutti-captura-${process.pid}`))   // ajustes aislados

app.whenReady().then(() => {
  if (!process.env.TUTTI_CAPTURE) migrateLegacyConfig()
  if (!process.env.TUTTI_CAPTURE && !process.env.TUTTI_SELFTEST) ensureLauncher()        // el comando `tutti` de la terminal
  Menu.setApplicationMenu(null)             // sin menú: los atajos los gestiona la propia app
  registerIpc()
  if (!process.env.TUTTI_CAPTURE && !process.env.TUTTI_SELFTEST) setupUpdater(() => win)
  void startHub(() => win).then(() => { if (process.env.TUTTI_SELFTEST) void runSelfTest() })
  if (!process.env.TUTTI_SELFTEST) createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
let closing = false
app.on('before-quit', (event) => {
  if (closing) return
  closing = true
  event.preventDefault()          // se cierran los procesos y se espera un instante: node-pty aborta si la app sale con avisos de salida pendientes
  stopHub()
  stopUpdater()
  pty.killAll()
  setTimeout(() => app.quit(), 400)
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
