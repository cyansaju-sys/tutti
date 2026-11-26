/**
 * El estilo de las pestañas de Tutti (chat, editor y agentes, panel lateral), en un solo sitio para que todas se vean igual:
 * un carril con fondo suave y la activa levantada dentro, como un control segmentado (no como las pestañas de un editor).
 */
export const TAB_TRACK = 'flex w-fit min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-ov/[0.05] p-0.5 [scrollbar-width:none]'
/** La fila que contiene el carril. */
export const TAB_ROW = 'flex h-9 min-w-0 shrink-0 items-center gap-1 overflow-hidden px-1.5'
export const TAB = 'group flex h-6 shrink-0 items-center gap-1.5 rounded-md transition-colors'
/** La activa: el acento suave de fondo, con el texto y un borde fino en acento (lo de dentro que iba atenuado, como la X, también pasa al acento). */
export const TAB_ON = 'bg-accent-bg text-accent ring-1 ring-accent/30 [&_.text-muted]:text-accent/70 [&_.text-text]:text-accent'
export const TAB_OFF = 'text-muted hover:bg-ov/[0.05] hover:text-text'
