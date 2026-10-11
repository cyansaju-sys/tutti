# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

## 1.0.9

- **Enviar código al agente:** selecciona código en el editor y pulsa `Ctrl+L` (o clic derecho → *Enviar selección al agente*) para escribir en el prompt del agente activo la referencia `@archivo:12-30` y el trozo, sin enviarlo; sin selección manda la línea del cursor. Si el trozo pasa de 200 líneas, solo va la referencia. El clic derecho del editor también ofrece copiar, cortar, pegar y seleccionar todo.
- **El contexto del proyecto vive en el repositorio:** ahora se guarda en `AGENTS.md` dentro de la carpeta del proyecto, el archivo estándar que leen también Codex, OpenCode, Cursor y otros, así que se versiona con git y se comparte con el equipo. No se crea hasta que escribes y guardas; si ya tenías un `AGENTS.md`, se abre tal cual. Los contextos que tenías guardados en la configuración de Tutti se siguen usando hasta que los guardes en el proyecto.
- **Contexto global:** una segunda pestaña con tus preferencias para **todos** los proyectos (cómo trabajas, tu estilo, lo que no quieres que hagan los agentes). Se entrega a cada agente antes del contexto del proyecto.
- **El contexto se ve en Markdown:** títulos, listas, código y enlaces con formato en lugar de texto plano; pulsa *Editar* (o doble clic) para modificarlo.
- **Consumo e historial de Codex:** la pestaña de consumo muestra los tokens de hoy, de 7 días y totales de Codex, el porcentaje de su límite (con cuándo se reinicia) y el historial de sus sesiones, que se pueden retomar, renombrar o borrar. Se lee de los registros locales de `~/.codex`, sin conectarse a nada.
- **Descartar cambios en Git:** un botón ↶ en cada archivo de *cambios* (y otro en la cabecera de la sección) deshace los cambios sin preparar, pidiendo confirmación. Los archivos nuevos van a la papelera, así que se pueden recuperar; lo preparado no se toca.
- **Cambios de un agente en un archivo abierto:** si un agente modifica un archivo que tienes abierto, Tutti lo detecta y marca en el editor las líneas antiguas (rojo) y las nuevas (verde). Puedes aceptar o deshacer cada tramo, o todos a la vez; lo aceptado queda como modificación local para que lo revises y lo guardes. Mientras decides, el archivo queda en solo lectura.
- **Más lenguajes en el editor:** resaltado para Rust, Go, Java, C/C++, PHP, shell, YAML y TOML.
- **Editor más cuidado:** íconos de Material en las sugerencias del autocompletado y en el plegado de código, guías de indentación y zoom con `Ctrl` + rueda (o `Ctrl` + `+` / `-`).
- **Íconos en «Abrir archivo»:** el selector rápido muestra el mismo ícono de cada archivo que el árbol.

## 1.0.8

- **Codex ya se conecta al reparto de tareas:** al abrirlo desde Tutti ve `list_agents`, `delegate_task`, `wait_agent` y `read_agent_output`, sin tocar su `config.toml`.
- **El MCP de Tutti, a la vista:** en la pestaña MCP hay una tarjeta «tutti» (global) que muestra a qué agentes se aplica y avisa si el de Antigravity apunta a una ruta que ya no existe (se repara al abrir Tutti).
- **Español e inglés:** el menú de la tuerca tiene un submenú *Idioma* (Automático, Español, Inglés). Cambia toda la interfaz al instante y se recuerda al reabrir.
- **Tienda de servidores MCP:** en la pestaña MCP puedes buscar en el registro oficial, ver la ficha de un servidor (qué es, quién lo publica y el comando exacto) e instalarlo en tus agentes. Los más conocidos salen primero, en *Recomendados*.
- **Un servidor, una tarjeta:** los MCP instalados ya no se separan por agente; al abrir una tarjeta ves en cuáles está aplicado y puedes quitarlo de uno o de todos. Las secciones se pliegan.
- **Copiar y pegar en terminales y agentes:** `Ctrl+C` (con texto seleccionado), `Ctrl+V`, `Ctrl+Shift+V` y `Shift+Insert`, y un menú con clic derecho. Las imágenes del portapapeles siguen llegando a Claude Code.
- **Tema claro más suave:** sin blanco puro, para no cansar la vista.
- **Menús mejorados:** los submenús se abren al pasar el ratón, con el valor actual, separadores y sin huecos; el resaltado del árbol de archivos sigue al ratón y la tecla de menú abre el de la fila marcada.
- **Se abre donde miras:** la ventana aparece en el monitor donde está el cursor.

## 1.0.7

- **Orches ahora se llama Tutti.** Tus ajustes y el contexto de tus proyectos se conservan. Si lo instalaste con el script, vuelve a ejecutarlo para que el comando pase a ser `tutti`; si no, la app se actualiza sola.
- **Buscar en el proyecto (Ctrl+Shift+F):** como en VS Code: distingue mayúsculas, palabra completa y expresiones regulares, con filtros de archivos a incluir y excluir. Los resultados salen agrupados por archivo y al pulsar uno se abre en esa línea. Respeta el .gitignore.
- **Buscar y reemplazar:** `Ctrl+Shift+H` añade el campo de reemplazo en todo el proyecto (por archivo o todo a la vez; salta los archivos con cambios sin guardar) y `Ctrl+H` abre el reemplazo dentro del archivo abierto. El cuadro de buscar del editor es nuevo: flotante, más pequeño y en español.
- **Nueva ventana vacía:** botón en la barra de título y opción en el menú del lanzador para abrir otra ventana de Tutti sin proyecto, con sus propios agentes.
- **Antigravity ya se conecta al reparto de tareas:** antes abría sin las herramientas de Tutti. Ahora, al abrirlo desde Tutti, ve `list_agents`, `delegate_task`, `wait_agent` y `read_agent_output`. Tutti registra un servidor «tutti» en la configuración MCP de Antigravity (`~/.gemini/config/mcp_config.json`); fuera de Tutti ese servidor no ofrece herramientas.
- **Tema claro y oscuro:** la tuerca de abajo en la barra lateral abre un menú para elegir *Tema oscuro*, *Tema claro* o *Automático* (sigue al sistema). Cambian también el editor, los colores del código y las terminales, y se recuerda al reabrir.
- **Icono nuevo:** tres círculos que se solapan, en los colores de la app. La pantalla de inicio de los agentes usa el mismo estilo.

## 1.0.6

- **Explorador más completo:** la cabecera del árbol tiene botones para nuevo archivo, nueva carpeta, actualizar, contraer todo y abrir otro proyecto. También puedes crear en la raíz pulsando un espacio vacío.
- **Nombre dentro del árbol:** al crear un archivo o carpeta, el nombre se escribe en el propio árbol, como en VS Code (Enter crea, Esc cancela).
- **Cada proyecto recuerda lo suyo:** al volver a un proyecto se recupera la pestaña de la barra lateral y los archivos que tenías abiertos. Al cambiar de proyecto se cierran agentes, terminales y archivos, y si hay cambios sin guardar te pregunta antes.
- **Un solo botón en Git:** con mensaje hace Commit; después pasa a Push, o a Pull si faltan cambios del remoto, con una animación del progreso. Sin repositorio remoto solo ofrece commit.
- **Selector de ramas nuevo:** al estilo de VS Code, con la fecha y el último commit de cada rama. Permite crear una rama, crearla a partir de otra y desproteger para ir a una rama o commit sin crear rama.
- **Repositorios recién creados:** Git ya funciona en un repositorio sin ningún commit.
- **Tooltips propios** que muestran el atajo de teclado como tecla.
- **Campos de texto más limpios:** sin borde ni resaltado de foco, con el mismo aspecto en toda la app.

## 1.0.5

- **Varias terminales:** el panel de terminal ahora admite varias a la vez, con barra de acciones (nueva, maximizar, cerrar) y una lista al costado. El chip «Terminal» de la barra de título abre un menú.
- **Modelos de cada agente:** al repartir tareas, los agentes ven los modelos que ofrece cada uno (Claude, OpenCode, Antigravity y otros) y pueden pedir uno concreto con `model`.
- **Tareas delegadas:** nuevo apartado en Agentes con a quién se delegó cada tarea, su estado, modelo y duración.
- **Aviso al líder:** cuando un agente termina una tarea, el líder recibe un mensaje `[Orches]` y no tiene que quedarse esperando.
- **Entrega fiable de tareas:** si un agente (por ejemplo Antigravity) abre sin recibir la tarea, la app la reenvía.
- **Borrar historial de IA:** botón para borrar las sesiones del proyecto, ahora también las de Antigravity.

## 1.0.4

- **Contexto del proyecto:** nuevo apartado en la barra lateral (Ctrl+Shift+K). Lo que escribas ahí lo leen los agentes que abras en ese proyecto (Claude Code y OpenCode). Se guarda fuera del repositorio.
- **Generar con IA:** un botón redacta el contexto a partir de un resumen pequeño del proyecto, con muy pocos tokens. Si cambias de apartado mientras tanto, se cancela.
- **Proyectos recientes:** cuando no hay agentes abiertos verás el historial de proyectos para volver a ellos con un clic, abrir otro o quitar uno con la X.
- **Barra lateral plegable:** al ocultarla quedan solo los iconos; doble clic en un icono la oculta o la muestra.
- **Archivos sin agentes:** si no hay ningún agente, el archivo que abras ocupa todo el espacio.
- **Versión a la vista:** el número de versión aparece junto al nombre de la app.
- **Diálogos centrados** en la ventana.
