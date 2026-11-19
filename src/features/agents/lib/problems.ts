import { useMemo } from 'react'
import { useT } from '@/lib/i18n'
import { findConflicts } from '@/features/files/lib/conflicts'
import { isDirty, useStore } from '@/store'

export interface Problem { id: string; kind: 'error' | 'warning'; path: string; message: string }

/**
 * Lo que está mal en el proyecto, como el panel Problemas de un IDE. La app no analiza el código, así que cuenta lo que sí sabe:
 * errores = conflictos de fusión sin resolver (los que marca git y los que tiene un archivo abierto); avisos = archivos con cambios sin guardar.
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
      if (isDirty(d)) out.push({ id: `u:${d.path}`, kind: 'warning', path: d.path, message: t('pb.unsaved') })
    }
    return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'error' ? -1 : 1))
  }, [git, docs, project, t])
}
