const KEY = 'recent_files'
const MAX_FILES = 20
const MAX_PROJECTS = 20

const readAll = async (): Promise<Record<string, string[]>> => {
  const raw = await window.api.settings.get(KEY)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string[]>) : {}
}
let queue: Promise<unknown> = Promise.resolve()       // cada escritura lee, cambia y guarda el conjunto: van una tras otra

/** Los últimos archivos abiertos en un proyecto, el más reciente primero. */
export async function loadRecentFiles(project: string): Promise<string[]> {
  const list = (await readAll())[project]
  return Array.isArray(list) ? list.filter((p) => typeof p === 'string') : []
}

/** Anota un archivo abierto (sube al primer lugar si ya estaba). */
export function rememberFile(project: string, path: string): void {
  queue = queue.then(async () => {
    const all = await readAll()
    const list = [path, ...(all[project] ?? []).filter((p) => p !== path)].slice(0, MAX_FILES)
    delete all[project]
    all[project] = list                                  // el proyecto más reciente va al final
    const keys = Object.keys(all)
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PROJECTS))) delete all[k]
    await window.api.settings.set(KEY, all)
  }).catch(() => undefined)
}
