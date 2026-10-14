/** Las frases de una versión, agrupadas bajo sus `### Título` (título vacío: las que van antes del primero). */
export interface ChangelogGroup { title: string; items: string[] }
export interface ChangelogEntry { version: string; groups: ChangelogGroup[] }

/** Secciones `## x.y.z` de CHANGELOG.md, de la más nueva a la más antigua (el orden del archivo), con sus `###`. */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const head = /^##\s+v?(\d+\.\d+\.\d+)/.exec(line)
    if (head) { entries.push({ version: head[1], groups: [] }); continue }
    const entry = entries.at(-1)
    if (!entry) continue
    const title = /^###\s+(.*\S)/.exec(line)
    if (title) { entry.groups.push({ title: title[1], items: [] }); continue }
    const item = /^[-*]\s+(.*\S)/.exec(line)
    if (!item) continue
    if (!entry.groups.length) entry.groups.push({ title: '', items: [] })
    entry.groups.at(-1)!.items.push(item[1])
  }
  for (const e of entries) e.groups = e.groups.filter((g) => g.items.length)
  return entries
}

const parts = (v: string): number[] => v.split('.').map((n) => Number(n) || 0)
export function compareVersions(a: string, b: string): number {
  const x = parts(a), y = parts(b)
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
  return 0
}

/** Novedades de las versiones posteriores a `seen` y hasta `current` (las que se saltó el usuario también cuentan). */
export function newSince(entries: ChangelogEntry[], seen: string, current: string): ChangelogEntry[] {
  return entries.filter((e) => compareVersions(e.version, seen) > 0 && compareVersions(e.version, current) <= 0)
}
