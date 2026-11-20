import { useMemo } from 'react'
import { useT } from '@/lib/i18n'
import { findConflicts } from '@/features/files/lib/conflicts'
import { useStore } from '@/store'

export interface Problem { id: string; kind: 'error' | 'warning'; path: string; message: string; line?: number }

/** Error de sintaxis de un JSON (con su línea), o null si es válido. Se admiten comentarios y comas finales: muchos .json de configuración (tsconfig, VS Code) los usan. */
function jsonError(text: string): { message: string; line: number } | null {
  const attempt = (src: string): string | null => { try { JSON.parse(src); return null } catch (e) { return e instanceof Error ? e.message : String(e) } }
  if (!text.trim() || attempt(text) === null) return null
  // comentarios y comas finales fuera de las cadenas, conservando saltos de línea para que la posición no cambie
  const loose = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m[0] === '"' ? m : m.replace(/[^\n]/g, ' '))).replace(/,(\s*[}\]])/g, ' $1')
  const message = attempt(loose)
  if (message === null) return null
  const pos = /position (\d+)/.exec(message)
  const at = pos ? Number(pos[1]) : loose.length
  const line = loose.slice(0, at).split('\n').length
  return { message: message.replace(/ \(line \d+ column \d+\)/, '').replace(/ in JSON at position \d+/, '').replace(/ at position \d+/, ''), line }
}

/**
 * Lo que está mal en el proyecto, como el panel Problemas de un IDE. La app no analiza el código, así que cuenta lo que sí sabe:
 * errores = conflictos de fusión sin resolver (los que marca git y los que tiene un archivo abierto) y JSON abiertos con errores de sintaxis; ya no se cuentan como problemas los cambios sin guardar.
 */
export function useProblems(): Problem[] {
  const t = useT()
  const git = useStore((s) => s.git)
  const docs = useStore((s) => s.docs)
  const project = useStore((s) => s.project)
  return useMemo(() => {
    const out: Problem[] = []
    const seen = new Set<string>()
    for (const f of git?.files ?? []) {
      if (f.code !== 'C' || !project) continue
      const path = `${project}/${f.path}`
      seen.add(path)
      out.push({ id: `c:${path}`, kind: 'error', path, message: t('pb.conflict') })
    }
    for (const d of docs) {
      if (d.kind !== 'text' || d.diffOf || d.original !== undefined) continue
      const n = findConflicts(d.text).length
      if (n && !seen.has(d.path)) out.push({ id: `m:${d.path}`, kind: 'error', path: d.path, message: t('pb.markers', { n }) })
      if (/\.json$/i.test(d.path) && !n) {
        const bad = jsonError(d.text)
        if (bad) out.push({ id: `j:${d.path}`, kind: 'error', path: d.path, message: bad.message, line: bad.line })
      }
    }
    return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'error' ? -1 : 1))
  }, [git, docs, project, t])
}
