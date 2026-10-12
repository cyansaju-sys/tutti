/**
 * Contexto para los agentes:
 *  - el de cada proyecto vive EN el repositorio, en AGENTS.md (el archivo estándar: Codex, OpenCode, Cursor y otros lo leen solos, y se
 *    versiona y comparte con git). Los proyectos que lo tenían en la configuración de Tutti siguen funcionando: se usa hasta que se guarde.
 *  - el global (tus preferencias en todos los proyectos): <config>/tutti/contexto-global.md, fuera de cualquier repositorio.
 * Al abrir un agente se le entregan los dos, el global primero.
 */
import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { translate, type Lang } from '../../../shared/i18n'
import { tm } from '../../utils/i18n'

/** Nombre del archivo de contexto dentro del proyecto. */
export const PROJECT_FILE = 'AGENTS.md'

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

export const projectContextFile = (project: string): string => join(project, PROJECT_FILE)
export const globalContextFile = (): string => join(configDir(), 'contexto-global.md')

/** El texto de un archivo de contexto, o '' si no existe, está vacío o sigue siendo la plantilla sin tocar. */
function readOne(file: string): string {
  try {
    const text = readFileSync(file, 'utf8').trim()
    return text && !isTemplate(text) ? text : ''
  } catch { return '' }
}

export interface OpenedContext { file: string; text: string; exists: boolean }

/**
 * Lo que se muestra al abrir el contexto de un proyecto. No crea nada: el archivo aparece en el repositorio cuando el usuario
 * escribe y guarda. Si todavía no existe, se parte de lo que había en la configuración (versión anterior) o de la plantilla.
 */
export function openProjectContext(project: string): OpenedContext {
  const file = projectContextFile(project)
  if (existsSync(file)) { try { return { file, text: readFileSync(file, 'utf8'), exists: true } } catch { /* se trata como si no existiera */ } }
  const old = readOne(legacyContextFile(project))
  return { file, text: old || template(), exists: false }
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

/**
 * Lo que reciben los agentes de un proyecto: el contexto global y el del proyecto (los que tengan algo escrito), o null si no hay nada.
 * `files` son los archivos que OpenCode debe cargar como instrucciones; AGENTS.md no va: OpenCode ya lo lee por su cuenta y saldría repetido.
 */
export function readContext(project: string): { files: string[]; text: string } | null {
  const mine = projectContextFile(project)
  const projectText = readOne(mine)
  const fallback = projectText ? '' : readOne(legacyContextFile(project))           // aún sin guardar en el repositorio: se usa el anterior
  const parts = [
    { file: globalContextFile(), text: readOne(globalContextFile()), native: false },
    { file: projectText ? mine : legacyContextFile(project), text: projectText || fallback, native: !!projectText }
  ].filter((p) => p.text)
  return parts.length ? { files: parts.filter((p) => !p.native).map((p) => p.file), text: parts.map((p) => p.text).join('\n\n') } : null
}
