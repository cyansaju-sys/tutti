# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

## 1.3.1

### Funcional

- **`.mcp.json`, la única fuente de los MCP del proyecto:** al añadir o editar un servidor del proyecto, Tutti solo toca `.mcp.json`. OpenCode lo recibe al abrirlo desde Tutti y Gemini CLI, Qwen Code y Cursor Agent se ponen al día con «Añadir lo que falta».
- **Antigravity y Codex con MCP de proyecto:** siguen `.mcp.json` solos. Antigravity, con un plugin en `.tutti/plugins/` (declarado en `.agents/plugins.json`); Codex, con el `.codex/config.toml` del proyecto, si el proyecto es de confianza. Sus servidores locales arrancan con `.tutti/mcp/launch.mjs`, que lee `.mcp.json` cada vez: cambiar un servidor no toca sus archivos.
- **Quitar servidores MCP:** papelera en la lista y «Quitar» en su ficha, con confirmación. Si está en `.mcp.json`, Antigravity y Codex lo pierden con él.
- **Codex vuelve a abrir desde Tutti:** si su configuración tenía una copia del servidor «tutti» de Antigravity (error «url is not supported for stdio»), Tutti la quita al abrirlo.
- **El servidor «tutti» de la app** ya no se copia entre agentes al sincronizar ni aparece en la lista de MCP.
- **El cursor de un agente recién abierto parpadea:** la terminal recibe el foco del teclado en cuanto se crea. Antes, a veces lo que escribías iba al editor o a la terminal de abajo.

### Estético

- **Una sola lista de MCP:** lo que le falta a cada servidor en otros agentes aparece bajo su nombre, y «Añadir lo que falta» y las demás acciones van al final de la lista.
- **Ficha de servidor más clara:** si está en `.mcp.json`, muestra una sola fuente y cómo lo recibe cada agente, como fichas en una fila con su estado y sus acciones.

## 1.3.0

### Funcional

- **AGENTS.md desde Tutti:** la pestaña Tutti puede crear, actualizar y quitar el `AGENTS.md` del proyecto, y los agentes reciben su contexto junto con `.tutti`.
- **MCP sincronizados entre agentes:** prueba, edita y sincroniza tus servidores MCP entre agentes, o estandarízalos para que todos usen la misma configuración.
- **Nuevos agentes:** Cursor y Qwen se suman a la gestión de MCP.
