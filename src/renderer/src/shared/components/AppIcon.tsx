import type { CSSProperties } from 'react'
import { useStore } from '@/shared/store'

/**
 * Un icono propio de la app (los de la barra lateral, el logo). Son SVG de un solo color: con el color del sistema activo
 * se pintan como máscara con `color` (una variable de styles.css) para seguir el tinte; si no, se muestra el archivo tal cual.
 */
export function AppIcon({ src, color = 'var(--color-accent)', size, className, alt = '' }: { src: string; color?: string; size?: number; className?: string; alt?: string }) {
  const tinted = useStore((s) => s.accent !== null)
  if (!tinted) return <img src={src} alt={alt} width={size} height={size} className={className} draggable={false} />
  const mask = `url("${src}") center / contain no-repeat`
  const style: CSSProperties = { display: 'block', width: size, height: size, backgroundColor: color, mask, WebkitMask: mask }
  return <span role={alt ? 'img' : undefined} aria-label={alt || undefined} className={className} style={style} />
}
