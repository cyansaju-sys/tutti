# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

## 1.5.11

### Cambios

- **Chats en paralelo:** varias conversaciones pueden responder a la vez. Puedes cambiar de conversación o abrir otra mientras una sigue trabajando; las que responden en segundo plano tienen el icono parpadeando, y al volver a ellas ves todo lo que hicieron, con sus permisos y preguntas pendientes. Cerrar una que está respondiendo con su X corta la respuesta.
- **Historial en la columna de chats:** debajo de las conversaciones abiertas salen las guardadas de este proyecto, en la misma lista y con hace cuánto fueron. Al pulsar una, sigue donde la dejaste. Su menú **⋯** tiene **Retomar**, **Fijar**, **Renombrar** y **Borrar**.
- **Columna de chats aparte:** va en su propia tarjeta, a toda la altura de la ventana (también junto a la terminal), y su ancho se cambia arrastrando el borde.
- **Modo agentes más estable:** ya no se sale de la vista al abrir un archivo (se abre a la derecha del chat), al partir el chat ni con **Ctrl+W**. Al partirlo, la segunda columna muestra el mismo saludo y, como es más estrecha, las tarjetas Vibe y Spec van sin explicación.
- **Barra flotante:** es de toda la zona del chat, tiene un estilo nuevo en forma de cápsula y se puede mover arrastrando su asa (se recuerda dónde la dejas). Ya no tiene botón para cerrar el chat.
- **Encima de la caja del chat:** el agente se cambia con un clic (Claude ↔ Codex) y al lado se ve el proyecto con su rama.
- **El chat es solo del Modo agentes:** el modo normal queda para los agentes de terminal. Allí ya no hay panel ni botón de chat, y el código que mandas desde el editor va al agente de la terminal. Lo que necesita el chat (como pedir algo desde la pestaña Tutti) cambia al Modo agentes.
- **Inicio del modo normal:** los agentes instalados se abren con un clic, hay un botón para **lanzar los roles** del proyecto y la sección **Retomar** tiene las últimas sesiones para abrirlas en su terminal.
- **Pestañas de agentes:** muestran un punto verde mientras el agente trabaja y cuánto tiempo lleva abierto. Al abrir un segundo agente, la vista se divide sola para ver los dos.
- **Pestañas renovadas:** las del chat, el editor, los agentes y el panel lateral van en un carril, con la activa resaltada en el color de acento.
- **Cambios renovado:** la rama va arriba en una tarjeta, el mensaje del commit y su botón comparten caja, y cada archivo muestra su estado (M, A, D…) en una etiqueta de color.
- **Carpetas compactas:** en el explorador, una carpeta que solo contiene otra se ve en una fila (`articulos / mantenimientos`). La carpeta en la que estás va subrayada, **← →** pasan de una a otra y el clic derecho sobre cada nombre abre su menú. Al crear dentro de una de ellas, la fila se separa para que se vea dónde va lo nuevo.

## 1.5.10

### Cambios

- **Modo agentes:** el ajuste «Ocupar todo» se llama ahora **Modo agentes** y cambia la vista del chat. A la izquierda están tus chats, con **Nueva sesión**, y la **Personalización** del proyecto (Agentes, Servidores MCP, Skills, Hooks, Steering y Specs, cada uno con su número), además de **Ver más** y **Ajustes**. En el centro, con el chat vacío, la caja aparece en medio con un saludo. A la derecha, el panel abre en **Archivos**, con pestañas para **Cambios** y un **+** para los demás apartados. Una barrita flotante da acceso rápido a Archivos, Cambios, la terminal, partir el chat y cerrarlo.
- **Personalizaciones del agente:** al pulsar un apartado de Personalización se abre un diálogo con todas las secciones a la izquierda y la elegida a la derecha, con una explicación de para qué sirve. Incluye los roles del proyecto (Agentes), Powers, Hooks, Roadmap, Documentación y las instrucciones para agentes.
- **Servidores MCP renovados:** se agrupan según dónde están guardados (compartido, este proyecto o todos los proyectos). Cada uno muestra su archivo, un botón **Probar** con su resultado, un interruptor para encenderlo o apagarlo y un menú con Detalles, Editar y Quitar.
- **Dictado por voz:** el micrófono de la caja del chat pasa tu voz a texto dentro de la app, sin enviar el audio a internet. Mientras hablas, cada vez que haces una pausa escribe lo que dijiste. El botón **ES / EN** elige el idioma. La primera vez descarga el modelo de voz (unos 130 MB).
- **Preguntas al margen (`/btw`) en su propio panel:** se abren en una columna al lado del chat, con su hilo de preguntas y respuestas y su caja para seguir preguntando. La papelera borra el hilo y la X lo oculta.
- **Esc detiene la respuesta** del chat, igual que el botón de parar. El botón ahora lo indica: **Detener (Esc)**.
- **Cambios sin nada pendiente:** en lugar de una línea suelta, aparece un aviso con accesos a **Abrir archivos** y **Buscar en archivos**.
- **Arreglo:** en proyectos grandes con la pestaña Git abierta, la ventana podía quedarse en negro al arrancar. Ya no pasa, y si en el futuro falla algún apartado, solo ese muestra un aviso con **Reintentar** y el resto de la app sigue funcionando.

## 1.5.9

### Cambios

- **Los chats ya no se retoman al abrir un proyecto:** los chats con Claude o Codex empiezan vacíos cada vez, así que la app arranca más rápido y ya no guarda las conversaciones en segundo plano. Siguen volviendo las terminales, el panel de abajo y los archivos abiertos.

## 1.5.8

### Cambios

- **Arranque más rápido y sin pantalla en blanco:** la app carga los ajustes, los archivos abiertos, las terminales y los chats a la vez, y si algo falla o tarda demasiado (proyectos grandes) se abre igual en vez de quedarse en blanco. Las ventanas nuevas también abren antes.
- **Uso renovado:** cada agente muestra su correo junto al nombre (por ejemplo **Claude - correo**) y solo aparecen los que tienen consumo visible, ordenados de la A a la Z. Los títulos van en mayúsculas y el historial es más compacto, con el tiempo a la derecha (`now`, `23h`, `4d`) y un punto en la conversación que estás usando. Se quitaron las filas Hoy, 7 días y Total.
- **Fijar conversaciones:** el menú de cada conversación del historial tiene **Fijar** y **Desfijar**. Las fijadas suben arriba y no se pueden borrar (ni con «Borrar todo»).
- **Cuentas:** el apartado **Cuentas** sale de los ajustes; el correo de cada agente está ahora en Uso.
- **Color del sistema:** al activarlo, la interfaz se tiñe con tonos medios, ni tan oscuros ni tan claros, con un matiz más visible.
- **Submenús:** tienen el fondo casi opaco, así que ya no se transparenta lo que hay detrás.

## 1.5.7

### Cambios

- **Markdown en vista previa:** los `.md` se abren en vista previa (y en el editor si están vacíos). Ya no se vuelve al código con doble clic: se usa el botón de la barra. Se puede desactivar con el nuevo ajuste **Vista previa de Markdown** del editor.
- **Menos consumo de IA:** nuevo tope de steering en los ajustes del editor (**Tope de steering (tokens)**, 3000 por defecto): lo que no cabe pasa a la lista de guías y el agente lo lee cuando hace falta. También puedes apagar **Sugerir el siguiente mensaje**, que cuesta una llamada extra por respuesta, y los formatos de `.tutti` ya no se envían en proyectos que no la usan.
- **AGENTS.md más corto:** el bloque de Tutti solo apunta a la carpeta de configuración (`.tutti` o `.agents`) y a su README, sin listar todo lo que hay dentro.
- **Pestaña Tutti:** Documentación muestra cuántos documentos tiene, se lee más rápido y el campo de nombre ya no pierde el foco al escribir.
- **Arreglo:** al volver a un proyecto ya no se abren terminales de más.

## 1.5.6

### Cambios

- **Se retoma lo que dejaste en cada proyecto:** al volver a un proyecto, o al abrir Tutti, vuelven sus terminales, la pestaña activa del panel de abajo (Terminal o Problemas), su alto y la terminal que usabas. Los chats abiertos con Claude o Codex también vuelven (sus pestañas y los últimos mensajes), y tu próximo mensaje continúa esa conversación. Se guarda solo, al cambiar algo.
- **Historial en la caja del chat:** con la caja vacía, **↑** y **↓** recorren los mensajes que ya enviaste en esa conversación, como en una terminal; al bajar del todo vuelve lo que estabas escribiendo.
- **«Enviar al agente» con el chat abierto:** si tienes el chat abierto, la ruta del archivo (o el trozo seleccionado del editor) va a su caja en vez de a un agente de la terminal.
- **Confirmar con más opciones:** el botón de la pestaña Git tiene ahora una flecha con **Confirmar**, **Confirmar (modificar el último)**, **Confirmar y subir** y **Confirmar y sincronizar**. Mientras un agente redacta el mensaje del commit, una barra de carga recorre la caja.
- **Rama y sincronizar en el pie:** la rama muestra un `*` si hay cambios sin confirmar y, a su lado, un botón para sincronizar (baja, sube o consulta el remoto) con los commits pendientes (`↓` y `↑`).
- **Panel de Problemas:** ahora avisa también de **errores de sintaxis en archivos JSON abiertos** (con su línea), se agrupa por archivo, tiene un **filtro** (texto, patrones como `**/*.ts` y `!` para excluir) y ya no cuenta los cambios sin guardar como problemas.
- **Panel de abajo renovado:** pestañas unidas, lista de terminales a un lado con una barrita de acento en la activa, y papelera para cerrar cada una.
- **Imágenes del chat:** se ven como etiquetas con miniatura, nombre y tamaño, tanto al adjuntarlas como en el mensaje enviado.
- **Menú de archivos:** «Renombrar» y «Borrar» van juntos, y las opciones de copiar forman una sola sección.
- **Arreglo:** en ventanas estrechas el editor ya no se sale de su columna ni tapa la barra lateral.

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
