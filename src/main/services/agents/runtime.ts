/** Lo que comparten las piezas del reparto de tareas: la ventana (para avisar a la interfaz), los proyectos conocidos y textos cortos. */
import type { BrowserWindow } from 'electron'
import { getSetting } from '../settings'
import * as pty from './pty'

let getWindow: () => BrowserWindow | null = () => null
export const setWindow = (fn: () => BrowserWindow | null): void => { getWindow = fn }
export const appWindow = (): BrowserWindow | null => getWindow()

/** Manda un evento a la interfaz (si la ventana sigue abierta). */
export const toUi = (channel: string, ...args: unknown[]): void => { getWindow()?.webContents.send(channel, ...args) }
export const toast = (message: string, kind: 'ok' | 'error' | 'info' = 'info'): void => toUi('orchestra:toast', message, kind)

export const BUSY_SECONDS = 4       // sin salida durante este tiempo = el agente ya no está trabajando
export const busy = (id: string): boolean => pty.idleFor(id) < BUSY_SECONDS

/** «Claude Code · proyecto» → «Claude Code». */
export const label = (name: string): string => name.split(' · ')[0]
export const oneLine = (text: string, max: number): string => text.replace(/\s+/g, ' ').trim().slice(0, max)

/** Proyecto abierto y los del historial: sirven para saber a cuál pertenece la carpeta de un agente. */
export function knownProjects(): string[] {
  const recent = getSetting('recent_projects')
  return [getSetting('project'), ...(Array.isArray(recent) ? recent : [])].filter((p): p is string => typeof p === 'string' && !!p)
}
