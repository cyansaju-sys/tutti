import { iconFor } from '@/shared/lib/icons'
import { useStore } from '@/shared/store'

/**
 * El ícono de un archivo o carpeta, del juego «Catppuccin Icons». `project` pinta la carpeta de un proyecto y `open` una carpeta desplegada.
 * Con el color del sistema activo, los genéricos (carpeta, proyecto, archivo sin tipo) se pintan como máscara con el color de la interfaz.
 */
export function FileIcon({ name, dir = false, open = false, project = false, className = 'size-4 shrink-0' }: { name: string; dir?: boolean; open?: boolean; project?: boolean; className?: string }) {
  const mode = useStore((s) => s.themeMode)
  const tinted = useStore((s) => s.accent !== null)
  const flavor = useStore((s) => s.iconPreview ?? s.iconFlavor)
  const icon = iconFor(name, { dir, open, root: project, mode, flavor })
  if (!icon) return <span className={className} />
  if (!tinted || !icon.plain) return <img src={icon.url} alt="" className={className} draggable={false} />
  const mask = `url("${icon.url}") center / contain no-repeat`
  return <span aria-hidden className={className} style={{ display: 'block', backgroundColor: dir || project ? 'var(--color-accent)' : 'var(--color-muted)', mask, WebkitMask: mask }} />
}
