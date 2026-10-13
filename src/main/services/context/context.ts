/**
 * Contexto para los agentes:
 *  - el de cada proyecto vive EN el repositorio y en UN solo archivo: el AGENTS.md del proyecto si ya lo tiene (el estándar que leen Codex,
 *    OpenCode, Cursor y otros: se edita ahí mismo, sin copias), o .tutti/steering/contexto.md si no. Se versiona y comparte con git.
 *    Los proyectos que lo tenían en la configuración de Tutti siguen funcionando: se usa hasta que se guarde.
 *  - el global (tus preferencias en todos los proyectos): <config>/tutti/contexto-global.md, fuera de cualquier repositorio.
 * Al abrir un agente se le entregan los dos, el global primero.
 */
import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { translate, type Lang } from '../../../shared/i18n'
import type { ContextSource } from '../../../shared/types'
import { tm } from '../../utils/i18n'
import { AGENTS_START, stripAgentsBlock } from './agentsPointer'
import { assembleSteering, changedFiles, loadSteering } from './steering'

/** Carpeta de Tutti dentro de cada proyecto y el archivo de contexto que contiene. */
export const TUTTI_DIR = '.tutti'
export const PROJECT_FILE = 'contexto.md'
/** El archivo estándar de otras herramientas: era donde se guardaba antes; se sigue leyendo si .tutti aún no tiene contexto. */
const AGENTS_FILE = 'AGENTS.md'

/** La carpeta de configuración de Tutti (TUTTI_CONFIG_DIR solo existe para las pruebas). */
const configDir = (): string => process.env.TUTTI_CONFIG_DIR || join(app.getPath('appData'), 'tutti')

/** La plantilla en el idioma actual; una escrita en el otro idioma también cuenta como «sin tocar». */
const template = (lang?: Lang): string => (lang ? translate(lang, 'm.ctx.template') : tm('m.ctx.template'))
const globalTemplate = (lang?: Lang): string => (lang ? translate(lang, 'm.ctx.globalTemplate') : tm('m.ctx.globalTemplate'))
const isTemplate = (text: string): boolean => [template('es'), template('en'), globalTemplate('es'), globalTemplate('en')].some((t) => t.trim() === text)

/** Dónde lo guardaba la versión anterior: la configuración de Tutti, con nombre legible + huella de la ruta. */
export function legacyContextFile(project: string): string {
  const name = basename(project).replace(/[^\w.-]+/g, '_') || 'proyecto'
  const hash = createHash('sha1').update(project).digest('hex').slice(0, 8)
  return join(configDir(), `${name}-${hash}`, 'contexto.md')
}

export const tuttiDir = (project: string): string => join(project, TUTTI_DIR)
export const globalContextFile = (): string => join(configDir(), 'contexto-global.md')
const tuttiContextFile = (project: string): string => join(tuttiDir(project), 'steering', PROJECT_FILE)
export const agentsFile = (project: string): string => join(project, AGENTS_FILE)

/** Un AGENTS.md que solo apunta a .tutti (lo dejaba una versión anterior) no cuenta como contexto propio. */
const POINTER_PATH = `${TUTTI_DIR}/steering/${PROJECT_FILE}`
/** Lo mismo con el bloque de Tutti (que apunta a .tutti, ver agentsPointer): ese bloque no es contexto, solo un puntero. */
const realAgents = (project: string): boolean => {
  try {
    const raw = readFileSync(agentsFile(project), 'utf8')
    const body = stripAgentsBlock(raw).trim()
    return !body.includes(POINTER_PATH) && (body !== '' || !raw.includes(AGENTS_START))
  } catch { return false }
}

/** El archivo del contexto del proyecto: el de .tutti si ya existe, si no el AGENTS.md que tenga, y si no el de .tutti (se crea al guardar). */
export function projectContextFile(project: string): string {
  const mine = tuttiContextFile(project)
  return existsSync(mine) || !realAgents(project) ? mine : agentsFile(project)
}

/**
 * Crea .tutti (con su README) y, si se pide, una subcarpeta suya (`sub`, p. ej. «specs» o «docs/how-to»). Al abrir un proyecto se llama
 * sin `sub`: solo .tutti y su README; cada subcarpeta aparece al añadir su primer elemento. No toca lo que ya exista. Devuelve la carpeta pedida.
 */
export function ensureProjectDir(project: string, sub = ''): string {
  const dir = tuttiDir(project)
  const target = sub ? join(dir, ...sub.split('/').filter((p) => p && p !== '..')) : dir
  try {
    mkdirSync(target, { recursive: true })
    const readme = join(dir, 'README.md')
    if (!existsSync(readme)) writeFileSync(readme, tm('m.ctx.tuttiReadme'), 'utf8')
  } catch { /* proyecto de solo lectura: se sigue sin la carpeta */ }
  return target
}

/** El texto de un archivo de contexto, o '' si no existe, está vacío o sigue siendo la plantilla sin tocar. */
function readOne(file: string): string {
  try {
    const text = stripAgentsBlock(readFileSync(file, 'utf8')).trim()
    return text && !isTemplate(text) && !text.includes(POINTER_PATH) ? text : ''
  } catch { return '' }
}

export interface OpenedContext { file: string; text: string; exists: boolean }

/**
 * Lo que se muestra al abrir el contexto de un proyecto. Si no hay archivo todavía, aparece cuando el usuario escribe y guarda; mientras tanto se parte de lo que había en la configuración (versión anterior) o de la plantilla.
 */
export function openProjectContext(project: string): OpenedContext {
  const file = projectContextFile(project)
  if (existsSync(file)) { try { return { file, text: readFileSync(file, 'utf8'), exists: true } } catch { /* se trata como si no existiera */ } }
  return { file, text: readOne(legacyContextFile(project)) || template(), exists: false }
}

/** Ruta del contexto global; lo crea con una plantilla si todavía no existe. */
export function ensureGlobalContext(): string {
  const file = globalContextFile()
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, globalTemplate(), 'utf8')
  }
  return file
}

/** El steering que entra ahora mismo: los de siempre, los que coinciden con los archivos con cambios y la lista de guías disponibles. */
function steeringNow(project: string): ReturnType<typeof assembleSteering> | null {
  const docs = loadSteering(project, { globalDir: globalSteeringDir() })
  if (!docs.length) return null
  return assembleSteering(project, docs, docs.some((d) => d.inclusion === 'fileMatch') ? [...new Set([...changedFiles(project), ...(working.get(project) ?? [])])] : [], globalSteeringDir())
}

/** La carpeta de los steering globales (los de todos tus proyectos), en la configuración de Tutti y fuera de cualquier repositorio. */
export const globalSteeringDir = (): string => join(configDir(), 'steering')
export function ensureGlobalSteeringDir(): string { const dir = globalSteeringDir(); try { mkdirSync(dir, { recursive: true }) } catch { /* sin permiso */ } return dir }

/** Los archivos que el usuario tiene abiertos en el editor (rutas relativas): para el modo `fileMatch`, además de los que tienen cambios en git. */
const working = new Map<string, string[]>()
export const setWorkingFiles = (project: string, files: string[]): void => { working.set(project, files.slice(0, 200)) }

/** El steering ya ensamblado se escribe en la configuración de Tutti para pasárselo a OpenCode como un solo archivo de instrucciones. */
function steeringFile(project: string, text: string): string {
  const name = `${basename(project).replace(/[^\w.-]+/g, '_') || 'proyecto'}-${createHash('sha1').update(project).digest('hex').slice(0, 8)}`
  const file = join(configDir(), name, 'steering.md')
  try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text, 'utf8') } catch { /* sin permiso: sigue entregándose por texto */ }
  return file
}

/** De dónde sale lo que reciben los agentes, con su tamaño: así se ve cuánto pesa cada parte. */
export function contextSources(project: string): ContextSource[] {
  const globalText = readOne(globalContextFile())
  const mine = projectContextFile(project)
  const projectText = readOne(mine)
  const legacy = projectText ? '' : readOne(legacyContextFile(project))
  const rows: ContextSource[] = []
  if (globalText) rows.push({ kind: 'global', name: 'global', file: globalContextFile(), chars: globalText.length })
  if (projectText || legacy) rows.push({ kind: 'project', name: basename(projectText ? mine : legacyContextFile(project)), file: projectText ? mine : legacyContextFile(project), chars: (projectText || legacy).length })
  for (const p of steeringNow(project)?.parts ?? []) rows.push({ kind: 'steering', name: p.doc.base, file: p.doc.file, chars: p.chars, mode: p.doc.inclusion, delivered: p.delivered })
  return rows
}

/**
 * Lo que reciben los agentes de un proyecto: el contexto global, el del proyecto y el steering (los de siempre completos y las demás guías
 * listadas con su ruta), o null si no hay nada.
 * `files` son los archivos que OpenCode debe cargar como instrucciones; AGENTS.md no va: OpenCode ya lo lee por su cuenta y saldría repetido.
 */
export function readContext(project: string): { files: string[]; text: string } | null {
  const mine = projectContextFile(project)
  const projectText = readOne(mine)
  const configText = projectText ? '' : readOne(legacyContextFile(project))          // aún sin guardar en el repositorio: se usa el anterior
  const steering = steeringNow(project)
  const parts = [
    { file: globalContextFile(), text: readOne(globalContextFile()), native: false },
    { file: projectText ? mine : legacyContextFile(project), text: projectText || configText, native: mine === agentsFile(project) && !!projectText },
    ...(steering?.text ? [{ file: steeringFile(project, steering.text), text: steering.text, native: false }] : []),
    ...(existsSync(agentsFile(project)) && existsSync(tuttiDir(project)) ? [{ file: join(tuttiDir(project), 'README.md'), text: tm('m.ctx.tuttiRef'), native: true }] : [])
  ].filter((p) => p.text)
  return parts.length ? { files: parts.filter((p) => !p.native).map((p) => p.file), text: parts.map((p) => p.text).join('\n\n') } : null
}
