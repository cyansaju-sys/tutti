/** Todos los archivos del proyecto (rutas absolutas), sin lo del .gitignore ni .git. Con `dirs`, también las carpetas (con «/» al final). */
export async function listProjectFiles(project: string, dirs = false): Promise<string[]> {
  const visit = async (dir: string, seen: Set<string>): Promise<string[]> => {
    if (seen.has(dir)) return []
    seen.add(dir)
    const listed = await window.api.fs.list(dir)
    const hidden = new Set(await window.api.git.ignored(project, listed.map((e) => e.path)))
    const out: string[] = []
    for (const e of listed) {
      if (hidden.has(e.path) || (e.isDir && e.name === '.git')) continue
      if (e.isDir) { if (dirs) out.push(`${e.path}/`); out.push(...await visit(e.path, seen)) } else out.push(e.path)
    }
    return out
  }
  return visit(project, new Set())
}
