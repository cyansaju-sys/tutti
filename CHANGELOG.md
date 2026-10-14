# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

## 1.3.3

### Funcional

- **El teclado va al agente que eliges:** al cerrar un archivo o un panel, al pulsar la cabecera de un agente, al ir a él desde las tareas delegadas o al mandarle algo desde la pestaña Tutti, el árbol o el editor, puedes seguir escribiéndole sin hacer clic en su terminal (si cierras un archivo y quedan otros, el foco va al editor). Antes el foco se perdía y no se podía escribir.

## 1.3.2

### Funcional

- **Roadmap del proyecto:** la pestaña Tutti tiene una sección nueva con el plan por fases (`.tutti/roadmap.md` o el `ROADMAP.md` que ya tengas en la raíz). Cada fase muestra su avance, la actual sale abierta y se marca lo **siguiente**; cada ítem se cruza con su cambio de OpenSpec (hecho, en marcha con sus tareas, sin spec o sin verificar). **¿Dónde nos quedamos?** le pide al agente que revise el roadmap, las tareas y git, compruebe en el código qué está hecho y te proponga los siguientes pasos sin tocar nada. Desde un ítem creas su spec con el formulario ya rellenado, al archivar un cambio su casilla se marca sola y, si aún no tienes roadmap, lo creas con una plantilla o lo redacta el agente.
- **Servidores MCP remotos por SSE:** al añadir o editar un remoto eliges HTTP o SSE, y los del registro traen el suyo. Claude Code, Gemini CLI y Qwen Code los instalan con ese transporte (antes todos iban como HTTP y los SSE no conectaban). Codex, que solo habla HTTP, avisa en lugar de instalarlo mal.
- **«Probar» se comporta como el agente:** arranca los servidores locales desde la carpeta del proyecto, expande `${VARIABLE}` y `${VARIABLE:-valor}` como `.mcp.json`, prueba los SSE y, si un servidor pide iniciar sesión (OAuth), te lo dice en vez de dar un error.
- **Los MCP de Codex se leen enteros:** su `config.toml` con `env = { ... }`, listas en varias líneas o comentarios ya no aparece como «distinto» al sincronizar.
- **Editar un servidor de `.mcp.json`** lo cambia en su sitio: ya no se quita y se vuelve a añadir, y Antigravity y Codex no lo pierden entre medias.
- **Copiar a otro agente un remoto de Gemini CLI o Antigravity** conserva su URL.
- **Windows:** añadir y quitar MCP funciona con las CLI instaladas con npm (`claude.cmd`, `gemini.cmd`…).
- **Las claves de los MCP desactivados, cifradas:** sus variables y cabeceras se guardan con el llavero del sistema, no en claro en los ajustes. Si no se pueden descifrar (por ejemplo, en otro equipo), Tutti no lo activa a medias: te pide editarlo para volver a escribirlas.
- **Archivos de configuración más seguros:** Tutti escribe los de cada agente de golpe, así que un agente u otra ventana nunca leen uno a medias. Respeta sus permisos y, si el archivo es un enlace, escribe en el original.
- **La lista de MCP y la sincronización cargan más rápido:** cada archivo de configuración se lee una sola vez.
- **Los mensajes de los MCP salen en tu idioma** (antes algunos salían siempre en español).
- **Modelos reales de cada agente al repartir tareas:** para Claude Code, Codex, Gemini CLI, Qwen Code y Copilot CLI, Tutti lee la lista de su `/model` (lo abre sin que lo veas, en la carpeta del proyecto, y sale sin elegir nada) en lugar de usar una lista fija que se quedaba desfasada. Se guarda un día. Si el agente pide confiar en la carpeta o iniciar sesión, Tutti no contesta por ti y usa la lista fija.

### Estético

- **Logo nuevo:** el ícono de la app, el de la pestaña Tutti, el de la carpeta `.tutti` y el que aparece cuando no hay agentes abiertos. El acento de la interfaz pasa al azul del logo; los fondos oscuros siguen igual.

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
