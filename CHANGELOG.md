# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

## 1.4.3

### Funcional

- **Elige la terminal que se abre:** el menú de ajustes (la rueda de la barra lateral) tiene ahora **Terminal…**, donde pones la ruta de un ejecutable (por ejemplo, el `bash.exe` de Git en Windows). Si la ruta no existe se avisa y no se guarda; vacío vuelve a la terminal del sistema, y si el archivo desaparece más tarde se usa también la del sistema.

### Agradecimientos

- **davidenriquehm98** propuso elegir la terminal desde los ajustes (PR #1).

## 1.4.2

### Funcional

- **Crear un Power ya no toca tu `.mcp.json`:** los servidores MCP se copian al Power igual que el steering, las skills y los hooks, y los originales se quedan donde estaban (también en el espejo de Antigravity y Codex). Las variables y cabeceras se guardan vacías salvo que marques la casilla de guardar valores. Desaparece el aviso de que los MCP se movían.
- **El explorador de archivos sigue al teclado:** al moverte con ↑↓ la fila marcada se desplaza a la vista en vez de salirse del panel.
- **Menú de la raíz en el hueco bajo el árbol:** el clic derecho en el espacio vacío bajo los archivos abre el menú de la carpeta del proyecto.

## 1.4.1

### Funcional

- **Powers, paquetes de herramientas y guías:** una pestaña nueva en la barra lateral (icono del enchufe, `Ctrl+Shift+X`) reúne tus Powers. Un Power es una carpeta con un `POWER.md` que puede traer servidores MCP (`mcp.json`), steering, skills y hooks, y sustituye a la antigua tienda de servidores MCP. Se instalan con el botón **+** desde una carpeta, en el proyecto (`.tutti/powers`, se comparte con git) o para todos tus proyectos, y se quitan con la papelera. Si un Power no es válido, aparece en rojo con el motivo.
- **Crea un Power con lo que ya tienes:** la opción **Crear con lo que tengo** deja elegir, con casillas, tus servidores MCP, steering, skills y hooks, y los empaqueta con nombre, descripción y palabras clave. Steering, skills, hooks y MCP se copian. Las variables y cabeceras se guardan vacías salvo que lo pidas, porque suelen llevar tokens.
- **Los agentes cargan los Powers solo cuando hacen falta:** el servidor MCP de Tutti ofrece `list_powers` (una línea por Power) y `use_power`, que entrega la guía, los archivos de steering y skills y las herramientas de sus servidores MCP. Así un Power instalado casi no ocupa contexto hasta que la tarea lo necesita.

## 1.4.0

### Funcional

- **Chat con tus agentes, sin abrir una terminal:** el icono de chat de la barra de título abre un panel al lado contrario de la barra lateral. Eliges un agente (Claude Code, OpenCode, Gemini CLI, Codex o agy) y conversas con él; la respuesta se va escribiendo según llega. Es solo para conversar: no edita archivos (Claude y Codex lo tienen forzado). La conversación se guarda por proyecto y se recupera al volver a abrirlo, y con Claude o Gemini puedes elegir el modelo.
- **`/` en el chat:** al escribirla aparecen los comandos del agente que guardas como archivo (los de tu proyecto y los tuyos) y los de Tutti: `/review` y `/security-review` revisan tus cambios, `/explain` explica una parte del proyecto, `/help` los lista y `/clear` borra la conversación.
- **`#` en el chat, para citar lo que importa:** primero eliges entre **Archivo**, **Carpeta** y **Otros**. Puedes citar un archivo o una carpeta del proyecto, lo que tienes sin confirmar, un commit, los cambios de tu rama, el archivo abierto o lo que seleccionaste en el editor (aunque no lo hayas guardado), un cambio de OpenSpec, el roadmap, una guía, skill o documento de `.tutti`, el contexto de los agentes, los hooks o lo último que muestra una terminal. Lo citado se adjunta al mensaje, y las preguntas siguientes lo conservan.
- **Ves lo que vas a enviar y lo que cuesta:** cada `#` aparece como una etiqueta con su tamaño aproximado en tokens y se pone en rojo si se recorta o no se puede adjuntar. Una línea bajo la conversación muestra su peso y, con Claude, lo que gastó la última respuesta y su coste. Los archivos con secretos (`.env`, claves, credenciales) nunca se adjuntan.
- **El menú de `#` es más cómodo:** busca aunque no escribas el nombre seguido, pone primero los archivos abiertos y los que tienen cambios, y se desplaza. Cada respuesta se puede copiar y enseña los archivos del proyecto que menciona, para abrirlos de un clic.
- **Proponer un cambio de spec es un cuadro de texto:** en vez del formulario, escribes qué quieres y se lo envías al agente con el botón del avión. Él crea en `openspec/changes` la propuesta, las specs, el diseño y las tareas, y no escribe código hasta que lo pidas.
- **Las instrucciones para agentes, en Tutti:** la sección **Instrucciones para agentes** (AGENTS.md) se puede plegar y ahora permite **generar el contexto del proyecto con un agente** y ver cuántos tokens recibirá cada agente al empezar, archivo por archivo. Sustituye a la pestaña Contexto, que desaparece; el contexto es solo el del proyecto.
- **Mueve la barra lateral y sus iconos:** desde los ajustes pasas la barra a la derecha o a la izquierda (sus iconos van con ella), y arrastras los iconos para ordenarlos a tu gusto. Se recuerda.
- **Descartar un archivo nuevo ya no falla en un disco externo:** cuando no hay papelera, el archivo se borra y el aviso lo dice.

### Estético

- **Un pie de ventana:** abajo, a la izquierda, la rama y los commits; a la derecha, la versión (al pulsarla se ven las novedades). Salen de la barra de título.
- **La sección MCP, solo en Tutti:** desaparece la pestaña de la barra lateral; los servidores MCP se gestionan desde la pestaña Tutti.

### Eliminado

- **La tienda de servidores MCP:** ya no se busca en el registro ni se instalan servidores desde ahí, porque va a ser sustituida por algo parecido a los Powers de Kiro. Mientras tanto sigues pudiendo añadir los tuyos con el botón **+**.
