# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

## 1.5.5

### Cambios

- **Chat con Codex:** el chat de Tutti ahora también habla con Codex (OpenAI), no solo con Claude. Usa los modelos y la sesión de tu cuenta de Codex y respeta tus comandos, MCP y menciones («@», «#»). En Codex, los modos Plan y Explorador solo leen; el resto puede escribir en el proyecto.
- **Dos chats a la vez:** el botón **Partir el chat en 2** abre una segunda columna, y cada chat puede ir con Claude o con Codex. Cada uno tiene su conversación, sus permisos y sus preguntas.
- **Pasarse tareas entre chats:** un chat puede encargarle una tarea al del otro agente (Claude ↔ Codex) y avisa cuando este termina o falla.
- **Cuentas:** un apartado **Cuentas** muestra el correo con el que tienes la sesión iniciada en Claude y en Codex.
- **`/init`:** crea un `AGENTS.md` para el repositorio (el estándar que leen los dos agentes) en lugar de un `CLAUDE.md`. Con Codex también tienes `/review` (revisa los cambios sin confirmar), `/new` y `/clear`.
- **Menú «+» del chat:** subir un archivo desde el equipo, añadir contexto y navegar por la web.
- **Ocupar todo:** nuevo ajuste del editor. Con la casilla marcada, al abrir un archivo el ancho se divide en chat | editor; sin marcar, el chat queda como un panel pequeño al lado.
- **Panel de Problemas:** avisa de conflictos de fusión sin resolver y de cambios sin guardar en el área de trabajo.
- **Atajos personalizables:** en la vista de atajos puedes cambiar cualquier atajo con un clic (avisa si es inválido, está reservado o ya lo usa otra acción) y volver al de fábrica.
- **Menú Archivo en la barra de título:** nueva ventana, abrir archivo o carpeta, abrir reciente, guardar, guardar todo, revertir archivo, cerrar editor, carpeta o ventana, y salir.
- **Crear .tutti:** si el proyecto no tiene carpeta `.tutti` ni `.agents`, la pestaña Tutti ofrece crearla.

## 1.5.4

### Cambios

- **Claude reparte tareas a otros agentes:** el chat se conecta al servidor MCP de Tutti, así que Claude puede encargar trabajo a OpenCode, Codex y demás agentes abiertos, y leer sus avisos.
- **Tus roles como subagentes:** los roles de `~/.agents/agents`, `~/.tutti/agents` y los del proyecto (si se repite un nombre, gana el del proyecto) están disponibles para Claude como subagentes. Los que piden otro agente se ignoran. En la lista de roles se ve cuál está trabajando.
- **Progreso de los subagentes:** cada uno se muestra en su bloque, con sus herramientas, tokens y tiempo, y su estado (trabajando, terminado, falló, detenido).
- **Plan de Claude:** en modo Plan, el plan se muestra completo y puedes **aprobarlo**, **aprobarlo y aceptar ediciones**, o **seguir planeando** con tus cambios.
- **Razonamiento visible:** si el modelo lo permite, el chat muestra su razonamiento resumido en un bloque aparte.
- **`/btw` pregunta:** una pregunta al margen que se responde sin interrumpir ni modificar la conversación, incluso mientras Claude trabaja.
- **Siguiente mensaje sugerido:** al acabar cada respuesta, Claude propone un mensaje y aparece de sugerencia en la caja; **Tab** lo rellena.
- **Tab** también elige el comando o archivo resaltado en las listas «/», «#» y «@».
- **Retomar conversaciones completas:** al abrir una del historial se ven también el razonamiento, las herramientas con su resultado y lo que hizo cada subagente, no solo el texto.
- **`/login` y `/logout` en el chat:** abren una terminal con `claude auth login` o `claude auth logout`, para iniciar o cerrar la sesión de Claude Code sin salir de Tutti.
- **Copiar bloques de código:** al pasar el ratón por un bloque de código (en el chat, los planes, `/btw` y los subagentes) sale un botón para copiarlo.

## 1.5.3

### Cambios

- **Cambios internos:** se reorganizó y simplificó parte del código y de la estructura del proyecto.

### Correcciones

- El chat con Claude encuentra los comandos y los servidores MCP (`npx`, lo instalado con nvm o en las carpetas habituales de binarios…) aunque abras Tutti desde el lanzador de escritorio y no desde una terminal. Antes podían no conectar.

## 1.5.2

### Cambios

- **Conversaciones del chat en pestañas:** cada conversación abierta sale como una pestaña en la cabecera del chat, con su X para cerrarla, y el **+** abre una nueva. Mientras Claude responde no se puede cambiar de pestaña.
- **Retomar conversaciones de Claude:** al pulsar una del historial se pregunta si abrirla en el chat de Tutti (con lo que se dijo) o en la terminal.
- **Lo que pides desde Tutti va al chat:** rellenar el AGENTS.md, crear hooks, specs o skills y aplicar una spec se envían al chat, con el modelo, esfuerzo y modo que tengas elegidos. El chat se abre si estaba cerrado.
- **El chat conoce tu proyecto:** lee su AGENTS.md y ya sabe el formato de los hooks y de las specs, así que esas peticiones son más cortas.

### Correcciones

- La pestaña Tutti ya no relee del disco hooks, steering, skills, docs y specs cada 5 segundos: los lee al abrir, al terminar el chat y al volver a la ventana. El AGENTS.md y el roadmap se siguen actualizando solos.

## 1.5.1

### Correcciones

- En la app instalada, el chat con Claude no cargaba los modelos ni los comandos «/» y no podía enviar mensajes. Ya funciona.


## 1.5.0

### Cambios

- **Chat con Claude dentro de Tutti:** un panel junto al editor, con tu suscripción y sin abrir una terminal. Respuesta en vivo, permisos por herramienta (con «Siempre»), preguntas con opciones, imágenes pegadas o soltadas, y el coste de la conversación. Modos Manual, Edit, Plan, Explorer y Auto, y modelo y esfuerzo a elegir. Se abre con el proyecto, se puede ensanchar arrastrando y recuerda si lo cierras.
- **Menciones en el chat:** `@` busca archivos y carpetas; `#` trae lo de tu proyecto (specs, roles, roadmap, documentos, hooks, steering, powers, archivos y los cambios de git con su diff). Lo que se añade al mensaje se ve desplegando «Contexto enviado a la IA».
- **Specs al estilo Kiro en lugar de OpenSpec:** cada spec es una carpeta `.tutti/specs/<nombre>` con `requirements.md`, `design.md` y `tasks.md`, y el avance sale de sus casillas.
- **Más harnes en camino:** se están integrando más agentes al chat, y se irá alternando entre su CLI y la interfaz de Tutti según lo que mejor funcione en cada uno.
- **Consumo de IA con el SDK:** los límites del plan de Claude y los títulos de sus conversaciones los da el SDK.

### Correcciones

- Los Powers que encajan con lo que pides se ofrecen solos, sin pasar por el servidor MCP. Solo funciona en el chat integrado.
