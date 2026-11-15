/**
 * El comando `tutti` de la terminal en Linux: ~/.local/bin/tutti, un lanzador (resources/bin/tutti) que abre este AppImage.
 * Se escribe al arrancar si falta o si es uno nuestro desactualizado (el AppImage cambió de sitio, el lanzador es de una
 * versión anterior); uno que no sea de Tutti no se toca. En Windows lo pone en el PATH el instalador (resources/installer.nsh).
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** El lanzador para el AppImage `appImage` (la ruta se escapa: va entre comillas dobles de bash). */
export const launcherFor = (template: string, appImage: string): string =>
  template.replace('@APPIMAGE@', () => appImage.replace(/[\\"$`]/g, '\\$&'))

/** Si lo escribió Tutti: el lanzador actual lleva la marca; el de las primeras versiones de install.sh solo hacía `exec …/Tutti.AppImage`. */
export const isOurLauncher = (text: string): boolean => text.includes('tutti-launcher') || text.includes('Tutti.AppImage"')

/** Deja `target` como el lanzador de `appImage`. Devuelve si lo escribió. */
export function writeLauncher(template: string, appImage: string, target: string): boolean {
  const wanted = launcherFor(template, appImage)
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null
  if (current === wanted || (current !== null && !isOurLauncher(current))) return false
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, wanted)
  chmodSync(target, 0o755)
  return true
}

export function ensureLauncher(): void {
  const appImage = process.env.APPIMAGE
  if (process.platform !== 'linux' || !appImage) return          // solo el AppImage: en desarrollo no hay qué lanzar
  try {
    writeLauncher(readFileSync(join(process.resourcesPath, 'bin', 'tutti'), 'utf8'), appImage, join(homedir(), '.local', 'bin', 'tutti'))
  } catch { /* sin permisos o sin la plantilla: el comando queda como estaba */ }
}
