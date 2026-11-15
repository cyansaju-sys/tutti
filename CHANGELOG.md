# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

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
