# Novedades

Cada versión lleva su sección `## x.y.z` con frases pensadas para quien usa la app. Tutti las muestra una vez, la primera vez que se abre tras actualizar.

## 1.2.4

### Funcional

- **Specs con OpenSpec:** la sección Specs de la pestaña Tutti usa ahora [OpenSpec](https://openspec.dev) en lugar del flujo de Kiro. Con su CLI, inicia `openspec/` en el proyecto y muestra la configuración, los cambios en marcha con su avance y las specs vigentes. Cada cambio se propone con un formulario (con plantillas o redactado por el agente) y se puede implementar con el agente, validar y archivar. Si no tienes el CLI, Tutti te da el comando de instalación.
- **Hooks más claros de autorizar:** el aviso fijo desaparece; al pulsar el interruptor de un hook en un proyecto sin autorizar, Tutti pide permitir los hooks. Mientras no se permitan, sus interruptores se ven apagados.
- **Sin peticiones repetidas al agente:** al pedirle algo a un agente desde la pestaña Tutti, ya no recibía la misma petición varias veces. A los agentes que reciben la tarea al arrancar no se les reenvía, y a los demás se les reenvía como mucho dos veces.
- **Menos avisos:** quitamos los que solo confirmaban algo evidente (enviado al agente, guardado, copiado, añadido…). Se mantienen los errores y los resultados importantes.

### Estético

- **Sección MCP de Tutti más limpia:** sin el título «Instalados» y con la misma altura máxima y scroll que la tienda.

## 1.2.3

### Funcional

- **Copiar, cortar y pegar en el explorador:** en el menú de archivos y carpetas (y con `Ctrl+C`, `Ctrl+X` y `Ctrl+V`). Al copiar, si el nombre ya existe se crea «nombre (2)» sin pisar nada; al cortar, las pestañas abiertas siguen a sus archivos.
- **Contexto con AGENTS.md:** si el proyecto tiene `AGENTS.md` y `.tutti`, los agentes reciben además una nota que les dice que consulten `.tutti` (steering, specs, skills y hooks).
- **Barra lateral:** pulsar el icono de la pestaña abierta oculta la sección, y pulsarlo de nuevo la muestra. Las pestañas se reordenan: Archivos, Tutti, Agentes, Contexto, Búsqueda, Git, MCP y Uso.
- **Scroll por subsección en Tutti:** Documentación, Specs, Hooks, Steering y Skills tienen su propio scroll cuando pasan de 5 elementos.
- **Altura ajustable desde la línea divisoria:** en MCP y en Uso, arrastra la línea bajo una sección para cambiar su altura (doble clic: vuelve a la automática).

### Estético

- **Hooks con icono** según su acción (comando o agente), y sin el aviso de «permitidos» una vez autorizados.
- **Secciones separadas por una línea** en Tutti y en MCP, con altura fija en sus encabezados y filas.
- **Sin el título «Instalados»** en la sección MCP de Tutti, con la misma altura máxima y scroll que la tienda.
- **Líneas divisorias** entre los elementos de la tienda MCP y del historial de sesiones.
- **Iconos de la barra lateral:** el recuadro de hover y de pestaña activa es más pequeño, y el de ajustes es de contorno.

## 1.2.2

- **Solicitud de mejora atendida — documentación bajo una metodología:** la carpeta `.tutti/docs` sigue **Diátaxis** (tutoriales, guías prácticas, referencia y explicación) y amplía lo que ya había con la **información general del proyecto**: la visión general (`overview.md`, que puede rellenar el agente) y los archivos base de steering (`product.md`, `tech.md` y `structure.md`). Leer más: https://cyansaju-sys.github.io/tutti/documentacion.html
- **Specs como en Kiro:** un formulario guiado en una pestaña del editor (funcionalidad o error, requisitos o diseño primero, o **Rápida**), con `bugfix.md` para los errores. Puedes pedirle al agente que redacte cada fase esperando tu aprobación, y desde la barra del editor **analizar** los requisitos, **actualizar** el diseño y las tareas, y **ejecutar las tareas** (la siguiente o todas).
- **Hooks:** archivos JSON en `.tutti/hooks` en el formato de Kiro. `PostFileSave` ejecuta un comando o le escribe un prompt al agente; el **+** ofrece un formulario guiado o describírselo al agente, se **editan** con el mismo formulario y solo corren si permites los hooks en ese proyecto.
- **Steering con los modos de Kiro:** siempre, por archivos, manual o automático, con referencias `#[[file:ruta]]`, los archivos base (`product`, `tech`, `structure`) y steering **global** para todos tus proyectos. `fileMatch` también cuenta los archivos abiertos en el editor.
- **Skills y documentación:** formulario para crear una skill (nombre, cuándo usarla e instrucciones), con opción de que las redacte el agente o de **importar** una que ya tengas; y la visión general de la documentación que rellena el agente.
- **Tutti, a fondo en la documentación:** la landing y la documentación explican cada parte de la pestaña Tutti y de la carpeta `.tutti`, con capturas nuevas.
- **Landing al estilo de Kiro:** cabecera con enlaces centrales, guías rápidas, preguntas frecuentes y pie en columnas.

## 1.2.1

- **La carpeta `.tutti` en cada proyecto:** Tutti crea `.tutti/` con un `README.md` al abrir un proyecto; las subcarpetas aparecen solo cuando añades algo. Se versiona con git y la comparte el equipo.
- **Pestaña Tutti:** muestra y crea **specs** al estilo Kiro (`requirements.md` en formato EARS, `design.md` y `tasks.md` con casillas y su avance), **documentación** con Diátaxis (tutoriales, guías prácticas, referencia y explicación), **steering**, **hooks**, **skills** y los servidores MCP instalados. Atajo `Ctrl+Shift+J`.
- **Los `.md` se ven como Markdown:** botón *Vista / Código* en el editor; los de `.tutti` se abren ya renderizados, con las casillas de las tareas y la cabecera del steering como etiquetas.
- **Un solo archivo de contexto por proyecto:** el `AGENTS.md` del proyecto si ya lo tiene (se edita ahí mismo, sin copias) o, si no, `.tutti/steering/contexto.md`.
- **Lo que reciben los agentes:** el panel de Contexto enseña de dónde sale cada parte y cuánto pesa en tokens. Un archivo de steering con `inclusion: always` en su cabecera se entrega a los agentes; los nuevos nacen con `inclusion: manual`.
- **Explorador:** selección múltiple (`Shift+↑/↓`, `Shift`+clic, `Ctrl`+clic), **arrastrar para mover** archivos y carpetas (con confirmación), renombrar en la propia fila, flechas para plegar carpetas, la raíz del proyecto plegable y carpetas teñidas según tengan archivos nuevos o modificados. La carpeta `.tutti` lleva el logo de Tutti.
- **MCP y Consumo más ordenados:** cada sección tiene su propio scroll y una altura que puedes ajustar arrastrando; las listas siguen el estilo del panel de extensiones, «Disponibles» solo aparece al buscar y el botón de borrar el historial queda fijo. Se oculta la tarjeta «tutti» de la lista de MCP.
- **Título en cada pestaña de la barra lateral**, con las pestañas reordenadas.
