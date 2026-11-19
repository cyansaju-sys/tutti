/**
 * Los formatos fijos de lo que Tutti guarda en `.tutti/`. Van una vez en el prompt de sistema del chat (que el SDK cachea) en lugar de
 * repetirse dentro de cada petición que se hace desde la pestaña Tutti.
 */
export const TUTTI_FORMATS = `Formatos de lo que se guarda en .tutti/ (síguelos cuando se te pida crear algo así):

- Hook (.tutti/hooks/<nombre-corto>.json), formato de Kiro: { "version": "v1", "hooks": [{ "name", "description", "trigger", "matcher", "action": { "type": "command" | "agent", "command" | "prompt" }, "timeout", "enabled" }] }. Eventos: PostFileSave (el único que ejecuta Tutti), PreToolUse, PostToolUse, Stop; "matcher" es una expresión regular sobre la ruta del archivo. Un hook nuevo se guarda con "enabled": false hasta que el usuario lo apruebe.
- Spec (.tutti/specs/<nombre>/): requirements.md (una introducción y requisitos numerados; cada uno como historia de usuario «Como <rol>, quiero <objetivo>, para <beneficio>» con criterios «CUANDO <evento> ENTONCES el sistema DEBERÁ <comportamiento>»), design.md (visión general, arquitectura y componentes, modelos de datos, manejo de errores y estrategia de pruebas) y tasks.md (casillas «- [ ]» pequeñas, agrupadas por sección, cada una con los requisitos que cubre; se marcan «- [x]» al terminarlas). Al planificar una spec no se escribe código de la aplicación.`

/** Lo que el chat le explica al agente de cómo trabaja Tutti: los formatos de `.tutti/` y que la terminal ya está en la carpeta del proyecto. */
export const tuttiPrompt = (project: string): string =>
  `${TUTTI_FORMATS}\n\nEl terminal ya está en la carpeta del proyecto (${project}) y ahí se queda entre comandos. No empieces los comandos con «cd» ni con rutas absolutas del proyecto: usa rutas relativas. Haz «cd» solo si de verdad necesitas otra carpeta.`
