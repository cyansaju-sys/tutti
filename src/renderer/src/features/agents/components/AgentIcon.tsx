import { useId } from 'react'
import { agentColors, agentInitial, agentLogo } from '@/renderer/src/features/agents/lib/agentIcon'

const base = import.meta.env.BASE_URL

/** Estrella de cuatro puntas centrada en (cx, cy): la marca de «IA». */
const sparkle = (cx: number, cy: number, r: number): string =>
  `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`

/**
 * Icono de un agente. Si tiene logo (Claude Code, OpenCode, Antigravity, Codex, Gemini...) se muestra tal cual,
 * sin recuadro; si no, y para cualquier agente nuevo, se genera uno: cuadrado con degradado, su inicial y una chispa de «IA».
 * `mark="spark"` dibuja solo la chispa (icono genérico de IA).
 */
export function AgentIcon({ name, command, size = 18, mark = 'letter', className }: {
  name: string; command?: string; size?: number; mark?: 'letter' | 'spark'; className?: string
}) {
  const gradient = useId()
  const { from, to, text } = agentColors(command ?? name)
  const logo = mark === 'letter' ? agentLogo(command ?? name) : null
  if (logo) {
    const url = `${base}icons/agents/${logo.file}.svg`
    return (
      <span role="img" aria-label={name} className={`grid shrink-0 place-items-center ${className ?? ''}`} style={{ width: size, height: size }}>
        {logo.mono
          // un solo color: se usa como máscara y se pinta con el color del texto, o con el suyo si lo tiene (sobre fondo oscuro un SVG negro no se vería)
          ? <span style={{ width: size, height: size, backgroundColor: logo.tint ?? 'var(--color-text)', maskImage: `url(${url})`, WebkitMaskImage: `url(${url})`, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} />
          : <img src={url} width={size} height={size} alt="" draggable={false} />}
      </span>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} role="img" aria-label={name} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill={`url(#${gradient})`} />
      {mark === 'spark' ? (
        <path d={sparkle(12, 12, 8.5)} fill={text} />
      ) : (
        <>
          <text x="11" y="16.6" textAnchor="middle" fontSize="13.5" fontWeight="700" fill={text} fontFamily="Inter, system-ui, sans-serif">{agentInitial(name)}</text>
          {size >= 20 && <path d={sparkle(19, 5.6, 3.1)} fill={text} opacity="0.85" />}
        </>
      )}
    </svg>
  )
}
