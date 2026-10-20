# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

## 1.3.8

### Seguridad

- **Electron 44:** Tutti pasa de Electron 33 a 44 e incorpora más de 30 correcciones de seguridad de Electron y Chromium, entre ellas fallos que permitían saltarse el aislamiento entre la página y el sistema o el sandbox de los iframes.
- **Cero vulnerabilidades conocidas en las dependencias:** también se actualizaron las herramientas con las que se construye la app (Vite 8, electron-builder 26, Vitest 4), que tenían avisos críticos.


## 1.3.7

### Funcional

- **Revisa cada rol antes de darlo por bueno:** cuando un rol termina queda **en revisión**. Desde el Plan de roles (o el líder) lo **aceptas**, y entonces arrancan los que dependen de él, o lo **rechazas** con lo que debe corregir: su agente sigue con su contexto y vuelve a avisar. Si su agente ya se cerró, el rol se relanza con otro y lleva tus indicaciones.
- **Comprobación automática por rol:** a cada rol le puedes poner un comando (por ejemplo `npm test -- api`) que Tutti ejecuta al terminar. Si falla, le devuelve la salida al agente para que lo arregle. También avisa si un rol tocó archivos que no son suyos.
- **Roles bloqueados o fallidos, a la vista:** el plan marca los roles que se bloquearon, fallaron o cuyo agente se cerró, y puedes **relanzarlos** o **cancelarlos**. También puedes **pausar el reparto** (los roles en marcha siguen) y reanudarlo.
- **Ver el plan entero:** **Ver el plan** muestra las **dependencias** entre roles y una **línea de tiempo** de lo que lleva cada uno.
- **Roles reutilizables y plantillas de plan:** guarda un rol (por ejemplo «tests» o «revisor») para usarlo en cualquier plan y proyecto, o guarda un plan entero como plantilla. Hay una incluida, **Implementar → tests → revisión**. Al crear un plan desde una plantilla escribes qué hay que hacer y todos los roles lo leen. Con **+** añades roles al plan (en blanco o reutilizables) y los quitas cuando quieras.
- **Los agentes pueden preguntar en vez de suponer:** un agente con una tarea delegada puede preguntarle al líder sin darla por terminada, y sigue en cuanto recibe la respuesta. Al acabar, deja un resumen de lo que hizo y los archivos que cambió, que el líder revisa sin leer su pantalla.
- **Pizarra compartida:** los agentes dejan en `.tutti/notes.md` las decisiones que afectan a los demás (nombres, contratos de API, convenciones) y las leen antes de trabajar.
- **Avisos que no te interrumpen:** los avisos de Tutti para un agente esperan a que esté libre y a que dejes de escribir en su panel, y le llegan juntos. Si un agente se queda esperando tu permiso o una respuesta, Tutti te lo dice.
- **Elige quién es el líder:** desde la cabecera de un agente lo haces **líder**: reparte las tareas, recibe los avisos y dirige el plan de roles. Cada panel muestra también el rol que está haciendo.
- **Un reparto que aprende:** en automático, Tutti recuerda qué agente y modelo terminó bien o falló en cada dificultad y evita a quien suele fallar.

## 1.3.6

### Funcional

- **Abre proyectos desde la terminal:** `tutti .` abre la carpeta actual como proyecto y `tutti ~/ruta/al/proyecto` abre esa, como `code .` en VS Code. Con un archivo (`tutti src/main.ts`) se abre su repositorio git (o su carpeta, si no está en ninguno) y el archivo queda delante en el editor. La carpeta pasa a ser el último proyecto y entra en los recientes; si ya la habías abierto, vuelven su pestaña y sus archivos. `tutti` a secas sigue abriendo el último proyecto.
- **El comando `tutti` ya no ocupa la terminal:** la app se abre aparte y puedes seguir usando la terminal. Si la ruta que le pasas no existe, te lo dice y no abre nada.
- **El comando `tutti` también en Windows:** el instalador lo añade al `PATH` de tu usuario (lo ven las terminales que abras después de instalar) y lo quita al desinstalar.
- **En Linux el comando se crea solo:** si descargaste el AppImage a mano, la primera vez que lo abres crea `~/.local/bin/tutti`, y lo mantiene al día si mueves el AppImage. Si ya tienes un `tutti` propio en esa ruta, no lo toca.
- **`Ctrl+Q` cierra la aplicación**, igual que el botón ✕ de la barra de título. Está en la lista de atajos (`F1`).

## 1.3.5

### Funcional

- **Roles para las tareas grandes:** ahora un agente puede preparar un plan, revisarlo y repartirlo en **roles**, cada uno con su responsabilidad, sus entregables, su criterio de terminado y los archivos que solo él edita. **El agente y el modelo de cada rol los eliges tú** (el plan no se puede aprobar hasta que cada rol tenga agente). Si prefieres que Tutti los asigne según la dificultad, la capacidad de cada modelo y su límite de uso, pon `"roles_assignment": "auto"` en `settings.json`. Un agente hace un solo rol a la vez: si el elegido está ocupado, el rol espera (en automático pasa a otro, abriendo uno nuevo si hace falta). Los roles que dependen de otros arrancan cuando estos terminan, y el líder recibe un aviso al acabar cada uno y al terminar todos.
- **Tú apruebas el plan antes de que se reparta:** el líder lo deja revisado y en el **Explorador**, bajo el árbol de archivos, aparece el **Plan de roles** (plegable, como la raíz del proyecto) con cada rol, su agente y su modelo, y el botón **Aprobar y repartir**. Mientras esperas, el líder no puede repartir otras tareas. También puedes **descartar el plan**, y si cierras la app con un plan aprobado, al volver aparece **Iniciar el reparto** para retomarlo. Si un rol no arranca, el panel dice por qué. Si prefieres que se reparta sin preguntar, pon `"roles_approval": false` en `settings.json`. El plan se guarda en `.tutti/roles.json`.
- **Edita los roles y elige a mano su agente y su modelo:** pulsa un rol del plan que aún no ha empezado para cambiar su nombre, responsabilidad, entregables, criterio de terminado, archivos, dificultad y dependencias, y para asignarle un agente (abierto o instalado) y uno de los modelos que ofrece. Lo que eliges a mano se respeta: si ese agente está ocupado, el rol espera en lugar de pasar a otro. En automático lo sigue eligiendo Tutti.
- **Las tareas delegadas indican de qué rol vienen.**

## 1.3.4

### Funcional

- **Ya se puede escribir al agente después de cerrar un archivo sin guardar:** *Bug:* al cerrar un archivo con cambios sin guardar (o cambiar de proyecto, reemplazar en el proyecto o reemplazar el contexto), el aviso era el `window.confirm` del sistema. En Linux, al cerrarse ese diálogo, Chromium se quedaba con el foco a medias: la terminal perdía el cursor parpadeante y no recibía el Espacio ni lo que escribías con composición. *Solución:* el aviso ahora es un diálogo de Tutti (`confirmAsk`, en `shared/lib/confirm.ts`). Se enfoca «Cancelar» para que un Enter o Espacio por descuido no descarte nada, y al responder el foco vuelve al elemento que lo tenía (la terminal o el editor).

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
