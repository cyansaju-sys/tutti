# Documentación de Tutti

Instalación, editor, agentes, reparto de tareas, MCP, git, atajos, ajustes y desarrollo. Las imágenes están en [`img/`](img). · [English](documentacion.en.md)

## Contenido

- [Instalar](#instalar)
- [Primeros pasos](#primeros-pasos)
- [Archivos y editor](#archivos)
- [Buscar y reemplazar](#buscar)
- [Agentes y terminales](#agentes)
- [Reparto de tareas](#reparto)
- [Contexto del proyecto](#contexto)
- [La pestaña Tutti](#tutti)
- [La carpeta .tutti](#dottutti)
- [Servidores MCP y tienda](#mcp)
- [Consumo e historial](#consumo)
- [Git](#git)
- [Apariencia e idioma](#apariencia)
- [Atajos de teclado](#atajos)
- [Ajustes y archivos](#ajustes)
- [Privacidad y seguridad](#privacidad)
- [Solución de problemas](#problemas)
- [Desarrollo](#desarrollo)
- [Contribuir](#contribuir)

<a id="instalar"></a>

## Instalar

Tutti es una aplicación de escritorio para **Linux** y **Windows** (macOS llegará más adelante). No necesita permisos de administrador.

### Linux

```
curl -fsSL https://github.com/cyansaju-sys/tutti/releases/latest/download/install.sh | bash
```

Descarga el AppImage de la última release en `~/.local/share/tutti/`, crea el comando `tutti` en `~/.local/bin` y la entrada del menú de aplicaciones. Si falta `libfuse2` (en Arch, `fuse2`) funciona igual, solo que abre más despacio.

| Comando | Qué hace |
|---|---|
| `install.sh` | Instala o reinstala la última versión |
| `install.sh --version 1.0.9` | Instala una versión concreta |
| `install.sh --uninstall` | Lo quita (tus ajustes en `~/.config/tutti` se conservan) |

Variables: `TUTTI_HOME` (dónde se guarda el AppImage) y `TUTTI_REPO` (usuario/repositorio).

### Windows

Descarga **Tutti-Setup-X.Y.Z.exe** de la [última release](https://github.com/cyansaju-sys/tutti/releases/latest) y ábrelo. Se instala para tu usuario, crea el acceso directo y añade el comando `tutti` a tu `PATH`.

> [!NOTE]
> El instalador no está firmado: Windows puede mostrar el aviso de SmartScreen. Pulsa **Más información → Ejecutar de todas formas**.

### Abrir desde la terminal

El comando `tutti` abre la app con un proyecto, como `code .` en VS Code. La app se abre aparte y la terminal queda libre.

| Comando | Qué abre |
|---|---|
| `tutti` | El último proyecto |
| `tutti .` | La carpeta actual como proyecto |
| `tutti ~/ruta/al/proyecto` | Esa carpeta como proyecto |
| `tutti src/main.ts` | El repositorio git del archivo (o su carpeta, si no está en ninguno) y el archivo en el editor |
| `tutti --new-window` | Una ventana vacía, sin proyecto |

Cada `tutti` abre una ventana nueva, con sus propios agentes. La carpeta queda como último proyecto y en los recientes; si ya la habías abierto, vuelven su pestaña y sus archivos. Si la ruta no existe, el comando lo dice y no abre nada.

En **Linux** el comando es `~/.local/bin/tutti`: lo crea `install.sh` y, si descargaste el AppImage a mano, la propia app la primera vez que la abres. La app lo mantiene al día (por ejemplo, si mueves el AppImage) y no toca un `tutti` que no sea suyo. En **Windows** el instalador añade `resources\bin` (la carpeta con `tutti.cmd`) al `PATH` de tu usuario y lo quita al desinstalar; lo ven las terminales que abras después de instalar.

### Actualizaciones

La app se actualiza sola. Cuando sale una release nueva aparece el botón **Actualizar a vX.Y.Z** arriba a la derecha: al pulsarlo descarga la versión, verifica su hash y se reinicia para aplicarla. La primera vez que la abres después de actualizar, un diálogo te cuenta las **novedades** (o las de todas las versiones que te saltaste); puedes volver a verlas pulsando el número de versión junto al nombre de la app.

![Botón de actualización](img/actualizar.png)

<a id="primeros-pasos"></a>

## Primeros pasos

1. **Abre un proyecto.** Si no hay ninguno, el árbol de archivos te lo pide; también puedes elegir uno de los *proyectos recientes* de la pantalla de inicio o usar el botón *Abrir otro proyecto* de la cabecera del árbol.
2. **Abre un agente** con `Ctrl`+`Shift`+`N`. Aparecen los que Tutti encontró instalados; escribe para filtrar y pulsa `Enter`.
3. **Trabaja como siempre.** Cada agente es su propia terminal dentro de la ventana. Puedes abrir varios, y también editar archivos, mirar git o añadir servidores MCP mientras trabajan.

![Pantalla de inicio](img/inicio.png)

Sin agentes abiertos, el espacio central es la **pantalla de inicio**: el botón *Elegir agente*, los atajos básicos y tus proyectos recientes (con *Abrir otro* y una ✕ para quitar uno del historial). Si abres un archivo sin agentes, el editor ocupa todo el espacio. `F1` muestra la lista completa de atajos.

### La ventana

| Zona | Qué contiene |
|---|---|
| Barra de título | Terminal, rama actual, permiso de edición, commits, versión, botón de actualización, nueva ventana y atajos |
| Barra lateral | Archivos, Buscar, Agentes, Git, Contexto, MCP y Consumo; abajo, la tuerca de ajustes |
| Centro | Editor con pestañas a la izquierda y los agentes en cuadrícula a la derecha |
| Panel inferior | Las terminales, con su lista a la derecha cuando hay varias |

La barra lateral se pliega a solo iconos con `Ctrl`+`Shift`+`B` o con doble clic en un icono. Los divisores se arrastran para cambiar el tamaño.

<a id="archivos"></a>

## Archivos y editor

El árbol usa los íconos de *Material Icon Theme* y muestra la letra de git en lo que cambió (`M` modificado, `A`/`U` nuevo, `D` borrado). Los archivos se abren en pestañas, **ya editables**, con colores, marcas de git en el margen (verde añadido, azul modificado, rojo borrado), autocompletado y recarga automática si otra herramienta cambia el archivo y aquí no hay cambios sin guardar.

![Archivos y editor](img/archivos-y-editor.png)

### Editar

- `Ctrl`+`S` guarda; `Ctrl`+`W` cierra la pestaña (pregunta si hay cambios sin guardar).
- El permiso **Edición** de la barra de título (o `Ctrl`+`Shift`+`L`) deja los archivos en solo lectura. Los archivos de más de 1 MB o que no son UTF-8 siempre se abren como solo lectura.
- **Enviar al agente:** selecciona código y pulsa `Ctrl`+`L` (o clic derecho → *Enviar selección al agente*) para escribir en el prompt del agente activo la referencia `@archivo:12-30` y el trozo en un bloque de código, **sin enviarlo**: sigues escribiendo tu petición. Sin selección manda la línea del cursor; si el trozo pasa de 200 líneas, solo va la referencia.
- Autocompletado con `Ctrl`+`Espacio`; `Enter` o `Tab` aceptan y `Esc` cierra la sugerencia.
- Resaltado de sintaxis para JavaScript/TypeScript (y JSX), Python, SQL, JSON, CSS, HTML, Markdown, XML, Vue y más.

### El árbol

La cabecera tiene los botones **Nuevo archivo**, **Nueva carpeta**, **Actualizar**, **Contraer todo** y **Abrir otro proyecto**. También puedes pulsar en un espacio vacío para crear algo en la raíz. El nombre se escribe en el propio árbol: `Enter` crea y `Esc` cancela. Con el árbol enfocado se navega con las flechas (→ abre, ← cierra o sube, `Enter` abre) y la fila marcada sigue al ratón.

![Nueva carpeta](img/nueva-carpeta.png)

### Clic derecho (o la tecla de menú)

| Acción | Qué hace |
|---|---|
| Enviar al agente | Escribe la ruta en el prompt del agente activo (`@ruta` en los que la entienden), sin pulsar Enter |
| Nuevo archivo / Nueva carpeta | Los crea dentro de la carpeta; el archivo se abre en el editor |
| Cortar / Copiar / Pegar | También con `Ctrl`+`X`, `Ctrl`+`C` y `Ctrl`+`V`. Pegar en un archivo lo hace en su carpeta; si el nombre ya existe, la copia se llama «nombre (2)» y no pisa nada. Cortar mueve y las pestañas abiertas siguen al archivo |
| Renombrar | Las pestañas abiertas siguen el cambio de nombre |
| Copiar ruta / ruta relativa | Al portapapeles |
| Borrar | Pide confirmación y lo manda a la **papelera** (se puede recuperar) |

### Seleccionar varios y mover

- `Shift`+`↓`/`↑` amplía la selección; `Shift`+clic selecciona un rango y `Ctrl`+clic añade o quita una fila. Con varias seleccionadas, el clic derecho ofrece enviarlas al agente, copiar sus rutas o borrarlas (`Supr` también).
- **Arrastra** archivos o carpetas sobre una carpeta (o sobre el espacio vacío, para la raíz) para moverlos. Tutti pregunta antes de mover, no pisa nada que ya exista y no deja meter una carpeta dentro de sí misma; las pestañas abiertas siguen al archivo.
- Las carpetas se tiñen según lo que tienen dentro: **verde** si solo hay archivos nuevos, **ámbar** si hay modificados, rojo si solo hay borrados. Renombrar se hace en la propia fila, sin diálogo.

### Cuando un agente cambia un archivo abierto

Tutti lo detecta y marca en el editor las líneas antiguas (rojo) y las nuevas (verde); arriba hay un panel con cada tramo, con *Aceptar* y *Deshacer* por tramo y para todos. Lo aceptado queda como modificación local, sin guardar, para que lo revises. Mientras decides, el archivo es de solo lectura.

### Lenguajes

Resaltado para JavaScript/TypeScript, Python, SQL, JSON, CSS, HTML/XML, Markdown, Rust, Go, Java, C/C++, PHP, shell, YAML y TOML. El autocompletado y el plegado usan íconos de Material; `Ctrl` + rueda (o `Ctrl` + `+` / `-`) cambia el zoom.

### Cada proyecto recuerda lo suyo

Al cambiar de proyecto se cierran sus agentes, terminales y archivos (si hay cambios sin guardar, antes pregunta). Al volver a uno ya conocido se recupera la pestaña de la barra lateral y los archivos que tenías abiertos.

<a id="buscar"></a>

## Buscar y reemplazar

### En el archivo abierto

`Ctrl`+`F` abre un cuadro flotante arriba a la derecha del editor con *distinguir mayúsculas* (`Aa`), *palabra completa* (`ab`) y *expresión regular* (`.*`), el contador («3 de 12») y los botones anterior / siguiente. `Ctrl`+`H` añade la fila de reemplazo (*Reemplazar* y *Todo*). `Enter` / `Shift`+`Enter` recorren las coincidencias y `Esc` cierra.

![Buscar en el archivo](img/buscar-en-archivo.png)

### En todo el proyecto

El apartado **Buscar** de la barra lateral (`Ctrl`+`Shift`+`F`) agrupa los resultados por archivo; al pulsar uno se abre en esa línea con la coincidencia seleccionada.

- **Filtros** acepta globs separados por comas para incluir y excluir: `*.ts, src/**` · `*.test.ts, docs/`.
- Respeta el `.gitignore` si el proyecto usa git, y salta binarios y archivos de más de 1 MB.
- Se corta a las 5000 coincidencias o 500 archivos (el contador muestra «+»).

### Reemplazar en el proyecto

`Ctrl`+`Shift`+`H` (o la flecha a la izquierda del campo) despliega el campo de reemplazo. Se puede reemplazar por archivo o todo a la vez, siempre pidiendo confirmación. Con expresión regular admite `$1`, `$&` y `$$`; conserva los fines de línea y **salta los archivos abiertos con cambios sin guardar** para no pisarlos.

![Buscar y reemplazar en el proyecto](img/buscar-en-proyecto.png)

<a id="agentes"></a>

## Agentes y terminales

`Ctrl`+`Shift`+`N` abre un agente de los instalados. Tutti los busca en el `PATH`, en el de tu shell de login y en las carpetas habituales, así que funciona aunque lances la app desde el menú. `Ctrl`+`Shift`+`T` abre una shell en el proyecto como sección aparte, con varias terminales en una lista a la derecha.

![Elegir agente](img/elegir-agente.png)

### Agentes que detecta

Claude Code, OpenCode, Codex, Gemini CLI, Aider, Cursor, Goose, Amp, Qwen Code, Copilot CLI, Droid, Kimi, Crush, Kilo, Cline, Plandex, Auggie, Forge, Mistral Vibe y Warp, cada uno con su logo. Antigravity (`agy`) se añade a mano.

### Añadir el tuyo

En *¿No aparece el tuyo? Añadir otro agente…* escribes un nombre y el comando (con argumentos si hace falta), o eliges uno de los ejecutables que la app encuentra en tus carpetas `bin`. Los propios sin logo llevan una insignia generada con su inicial. Se quitan desde la lista de agentes.

### Terminales

![Varias terminales](img/terminales.png)

- Varias terminales a la vez, en una lista a la derecha del panel; el panel se puede maximizar y cerrar entero.
- Si un proceso no arranca o termina, un aviso lo explica (comando no encontrado, señal, código de salida).
- Con varios agentes, se reparten en cuadrícula y `Ctrl`+`AvPág` / `RePág` salta de uno a otro.

### Copiar y pegar

| Atajo | Qué hace |
|---|---|
| `Ctrl`+`C` | Copia si hay texto seleccionado; si no, sigue siendo «interrumpir» |
| `Ctrl`+`Shift`+`C` | Copia siempre |
| `Ctrl`+`V`, `Ctrl`+`Shift`+`V`, `Shift`+`Insert` | Pegan el texto del portapapeles (varias líneas incluidas) |
| Clic derecho | Menú con *Copiar*, *Pegar* y *Seleccionar todo* |

Si el portapapeles no tiene texto (una captura, por ejemplo), `Ctrl`+`V` se lo deja al agente, que la lee él mismo.

### Varias ventanas

El botón de la barra de título (o *Nueva ventana vacía* en el menú del lanzador, con clic derecho sobre el icono en Linux) abre otra ventana **sin proyecto**. Es otro proceso, con sus propios agentes, su servidor de tareas y su proyecto. Los ajustes se comparten, así que lo último que abras en cualquier ventana es lo que se reabre al iniciar. La ventana nueva se abre en el monitor donde está el cursor.

<a id="reparto"></a>

## Reparto de tareas

Tutti abre un servidor MCP local (solo en `127.0.0.1`, con un token distinto en cada ejecución) y conecta a cada agente a él con seis herramientas:

| Herramienta | Para qué sirve |
|---|---|
| `list_agents` | Ver los agentes abiertos y los instalados, con su modelo, nivel y límite de uso |
| `delegate_task` | Mandar una tarea a un agente abierto o pedir uno nuevo (incluso del mismo tipo) |
| `wait_agent` | Esperar a que un agente termine y recibir las últimas líneas de su pantalla |
| `read_agent_output` | Leer la pantalla de un agente y saber si sigue ocupado |
| `propose_roles` | Proponer los roles de un plan: Tutti los valida y devuelve a qué agente y modelo iría cada uno, sin lanzar nada |
| `confirm_roles` | Dar el plan por revisado: tras tu aprobación, Tutti reparte los roles |

![Agentes repartiéndose una tarea](img/agentes.png)

El primer agente que abres es el **líder**. Los que él (u otro) abre salen en su propio panel marcado «sub de …», y el apartado **Agentes** de la barra lateral lista las tareas delegadas con su estado (*trabajando*, *terminada*, *cerrada*), modelo, dificultad y duración. Cuando un agente termina, Tutti avisa al que se la mandó.

### Asigna según la capacidad

Si el agente pasa `difficulty` (`easy`, `medium`, `hard`), Tutti revisa la lista, comprueba el nivel del modelo (*basic*, *standard*, *advanced*) y su límite de uso, y elige el más adecuado: el justo para la tarea (no gasta uno avanzado en algo fácil), libre antes que ocupado y que no tenga el límite agotado. Con `agent: "auto"` elige él; si el pedido no tiene capacidad suficiente se rechaza y se propone otro (`force` lo mantiene). También se puede pedir un `model` concreto para los agentes que lo permiten al abrirse.

### Roles para una tarea grande

Cuando una tarea tiene varias partes, el agente líder sigue este flujo antes de repartir nada:

1. **Plan.** Lo escribe en `.tutti/roadmap.md` y, si es grande, en un cambio de OpenSpec.
2. **Revisión.** Lo repasa: ¿está completo?, ¿cada parte tiene criterio de terminado?, ¿hay partes que tocan los mismos archivos?
3. **Roles.** Los deriva del plan con `propose_roles`. Cada rol lleva `id`, `name`, `responsibility`, `deliverables`, `done` (criterio de terminado), `files` (los que solo ese rol edita), `difficulty` y `dependsOn`. Tutti rechaza ids repetidos, dependencias en ciclo y archivos compartidos entre roles, y devuelve avisos (sin plan referenciado, roles en cadena sin paralelismo, roles sin agente libre…).
4. **Elección de agentes.** Tú eliges, para cada rol, su agente y su modelo en el panel (pulsa el rol). Hasta que todos tengan agente, el plan no se puede aprobar.
5. **Aprobación.** El líder llama a `confirm_roles` y el plan aparece en **Explorador → Plan de roles** (bajo el árbol; se pliega como la raíz del proyecto) con el botón **Aprobar y repartir**. Hasta que lo pulses, el líder no puede repartir otras tareas.
6. **Reparto.** Tutti lanza cada rol en el agente y el modelo que elegiste cuando terminan los roles de los que depende. Avisa al líder al acabar cada rol y al acabar todos, y el líder revisa cada entregable contra su criterio de terminado.

**Un agente, un rol a la vez.** Si el agente que elegiste está ocupado o sin cuota, el rol espera. Con `"roles_assignment": "auto"` en `settings.json` Tutti elige por ti según la dificultad, y si el agente ideal está ocupado, sin cuota o no ofrece el modelo, el rol pasa a otro: uno libre ya abierto, una instancia nueva de otro agente instalado o, si ninguno llega al nivel, el más capaz (se avisa). Si no queda ninguno, el rol espera en cola hasta que alguno se libere; no se lo queda el líder. Si un rol no se puede lanzar, se reintenta al minuto.

El plan se guarda en `.tutti/roles.json` (qué roles hay, su estado y cuáles terminaron). Con `"roles_approval": false` en `settings.json` el plan se reparte en cuanto el líder lo confirma, sin esperar tu aprobación. El botón de la papelera descarta el plan (no está disponible con roles en marcha). Si cierras Tutti con un plan aprobado, al volver sale como «Aprobado, sin iniciar» y el botón **Iniciar el reparto** lo retoma (hace falta un agente abierto, que hará de líder). Los roles que no arrancan muestran debajo el motivo (sin agente libre, el modelo no está disponible, no se pudo abrir…).

**Editar y asignar a mano.** Pulsa un rol que aún no ha empezado para cambiar su nombre, responsabilidad, entregables, criterio de terminado, archivos, dificultad y dependencias (Tutti vuelve a validar todo el plan). Ahí mismo eliges su **agente** (uno abierto o uno instalado) y, si el agente deja fijarlo al abrirse, su **modelo**. Lo elegido a mano se respeta y reserva su agente antes que el reparto automático; si ese agente está ocupado, sin cuota o ya no existe, el rol espera en cola en lugar de pasar a otro. Con «Automático» sigue eligiendo Tutti.

### Cómo se conecta cada agente

| Agente | Mecanismo |
|---|---|
| Claude Code | `--mcp-config` con la URL y la clave de su sesión, y las herramientas ya permitidas |
| OpenCode | Variable `OPENCODE_CONFIG_CONTENT`; en 2.x se lanza con `--standalone` para no mezclar su configuración con la de otros OpenCode |
| Codex | `-c mcp_servers.tutti.url=…` y la clave por variable de entorno: no se toca su `config.toml` |
| Antigravity | No admite configuración por proceso: Tutti registra un servidor «tutti» en `~/.gemini/config/mcp_config.json` (un pequeño puente en `<config>/tutti/mcp-bridge.mjs`) y a cada panel le pasa la dirección y la clave por entorno. Fuera de Tutti ese servidor no ofrece herramientas. Si Antigravity pide permiso la primera vez, apruébalo |

Se desactiva con `"orchestration": false` en `settings.json`.

<a id="contexto"></a>

## Contexto del proyecto

El apartado **Contexto** (`Ctrl`+`Shift`+`K`) guarda un texto que **leen los agentes que abras**: qué es el proyecto, cómo se ejecuta, convenciones y cómo prefieres trabajar. Tiene dos capas y se ve como **Markdown** (títulos, listas, código y enlaces con formato); *Editar* o un doble clic lo abren para modificarlo.

![Contexto del proyecto](img/contexto.png)

### Proyecto

- Vive **en el repositorio**, en **un solo archivo**: el `AGENTS.md` del proyecto si ya lo tiene (es el estándar que también leen Codex, OpenCode, Cursor y otros agentes, y se edita ahí mismo, sin copias) o, si no, `.tutti/steering/contexto.md`. Al estar en git se versiona y se comparte con el equipo.
- No se crea hasta que escribes y guardas (se guarda solo). Un contexto ya guardado en `.tutti` manda sobre un `AGENTS.md` que aparezca después.
- Los contextos que tenías de la versión anterior (guardados en la configuración de Tutti, fuera del repositorio) se siguen usando hasta que los guardes en el proyecto.
- **Generar con IA** lo redacta un agente a partir de un resumen pequeño del proyecto (estructura, `package.json`, inicio del README, últimos commits), sin dejarle explorar, para gastar muy pocos tokens. Con Claude usa el modelo pequeño `haiku`; si ningún agente responde arma un borrador con reglas. Se escribe en el idioma de la interfaz y se cancela al cambiar de apartado.

### Global

La pestaña **Global** guarda tus preferencias para **todos** los proyectos —cómo trabajas, tu estilo de código, lo que no quieres que hagan los agentes—. Se guarda en la configuración de Tutti (`contexto-global.md`), nunca en un repositorio, y funciona aunque no haya proyecto abierto.

### Quién lo recibe

Al abrir un agente desde Tutti recibe primero el global y después el del proyecto. Claude Code los toma como parte de su prompt de sistema y OpenCode como archivos de instrucciones (`AGENTS.md` no se repite porque OpenCode ya lo lee solo). Funciona también si el agente se abre en una subcarpeta y sin el reparto de tareas. Una plantilla sin tocar no se envía.

### Lo que reciben los agentes

Bajo el editor, el panel **Lo que reciben los agentes** enseña de dónde sale lo que recibirá cada agente (el global, el del proyecto y los archivos de `steering` marcados) y cuánto pesa cada parte en tokens aproximados. Si pasa de unos 3 000 avisa: cada agente lo lee entero al empezar y gasta tokens.

Los archivos de `.tutti/steering/` siguen el **steering de Kiro**: una cabecera opcional (`---` … `---`) dice cuándo se entregan.

| Modo | Qué hace |
|---|---|
| `inclusion: always` (por defecto) | Se entrega entero en cada sesión |
| `inclusion: fileMatch` + `fileMatchPattern` | Entero si hay cambios en git o archivos abiertos en el editor que coinciden con el patrón (uno o una lista); si no, solo se lista |
| `inclusion: manual` | No se copia: se lista con su ruta para que el agente la lea cuando la menciones |
| `inclusion: auto` + `name` y `description` | No se copia: se lista con su descripción para que el agente la lea cuando venga al caso |

Las guías «solo listadas» cuestan pocos tokens: el agente ve su nombre, descripción y ruta, y abre la que le sirva. Dentro del texto puedes enlazar archivos reales con `#[[file:ruta]]`, `#[[file:ruta:12-28]]` (un rango de líneas) o `#[[folder:ruta]]`; se sustituyen por su contenido al entregarlo y nunca salen del proyecto. El **+** de Steering abre un formulario con los cuatro modos, y puede crear los tres **archivos base** de Kiro (`product.md`, `tech.md` y `structure.md`) y pedirle al agente que los rellene explorando el proyecto.

<a id="tutti"></a>

## La pestaña Tutti

La pestaña **Tutti** (`Ctrl`+`Shift`+`J`) reúne en un solo sitio lo que los agentes necesitan saber de tu proyecto: documentación, especificaciones, guías, hooks, skills y los servidores MCP instalados. Todo vive en la carpeta [`.tutti`](#dottutti) del proyecto, así que se versiona con git y lo comparte el equipo.

![La pestaña Tutti](img/tutti.png)

### Las secciones

| Sección | Qué muestra | El **+** hace… |
|---|---|---|
| **Documentación** | Las categorías (Diátaxis) que ya tienen documentos | Pide el nombre y la categoría y abre el documento |
| **Specs (OpenSpec)** | La configuración, los cambios en marcha con su avance (`2/5`) y las specs vigentes de `openspec/` | Abre el formulario para proponer un cambio, en una pestaña del editor |
| **Hooks** | Cada hook con su evento y un interruptor para activarlo | Abre el formulario para crear un hook |
| **Steering** | Las guías, con su modo (Siempre, Por archivos, Manual, Automático) | Abre el formulario del steering y de los archivos base |
| **Skills** | Una carpeta por skill; al pulsar se abre su `SKILL.md` | Abre el formulario de la skill (nombre, cuándo usarla e instrucciones) |
| **Servidores MCP** | Los MCP instalados en tus agentes (los mismos de la pestaña MCP) | Abre el diálogo de añadir un servidor |

Cada sección se pliega (y se recuerda). Si una sección está vacía, en lugar de una lista verás un botón de ancho completo para crear el primer elemento. La carpeta `.tutti` y sus subcarpetas **no se crean hasta que añades algo**: abrir un proyecto o mirar la pestaña no escribe nada, salvo el `README.md` de `.tutti`.

### AGENTS.md apuntando a .tutti

Al final de la pestaña, la fila **AGENTS.md** gestiona el archivo estándar donde los agentes (Codex, OpenCode, Cursor, Copilot…) leen cómo trabajar en tu proyecto. Tutti añade un **bloque marcado** (`<!-- tutti:start -->` … `<!-- tutti:end -->`) que lista lo que hay en `.tutti/` —steering, especificaciones de `openspec/`, documentación y skills— y pide a los agentes que lo consulten. Así cualquier agente que lea `AGENTS.md` sabe dónde mirar, **también fuera de Tutti**. Es un puntero, no una copia: el contenido sigue en `.tutti/`.

- **Crear AGENTS.md** escribe el bloque y, a continuación, **un agente lo rellena**: qué es el proyecto, los comandos exactos para instalar, ejecutar y probar, la estructura, las convenciones y lo que no debe hacer, siempre encima del bloque y **remitiendo por su ruta** a lo que ya está en `.tutti/` en vez de copiarlo. Revisa el resultado, sobre todo los comandos.
- Si ya tienes un `AGENTS.md`, **Añadir el bloque** solo toca su bloque; el resto es tuyo. **Actualizar** rehace la lista cuando se queda desfasada (la fila avisa) y **Quitar el bloque** lo elimina (y borra el archivo si se queda vacío). Si existe y no tiene texto propio, **Rellenar con el agente** hace lo mismo que al crearlo.
- Un `AGENTS.md` que solo tiene el bloque **no cuenta como contexto propio** (ese va en `.tutti/steering/contexto.md`), y el bloque no se entrega repetido a los agentes que abres desde Tutti.

### Formularios en pestañas del editor

Proponer un cambio, crear un hook o un steering abre un **formulario como una pestaña más del editor** (junto a tus archivos), no una ventana flotante. Al terminar, la pestaña pasa al archivo recién creado. Si no hay un agente abierto, las opciones que le piden algo al agente salen desactivadas, con la explicación.

### Ver los .md como Markdown

Los archivos `.md` tienen un botón **Vista / Código** en la barra de ruta del editor. Los de `.tutti` se abren ya renderizados, con las casillas de `tasks.md` marcadas y las etiquetas de la cabecera de un steering; doble clic vuelve al código.

![Un archivo Markdown en vista](img/md-vista.png)

En el Explorador de archivos, la carpeta `.tutti` lleva el logo de Tutti para reconocerla de un vistazo.

<a id="dottutti"></a>

## La carpeta .tutti

Tutti crea una carpeta `.tutti` en cada proyecto que abres, con un `README.md` que explica su contenido. Es texto plano (Markdown y JSON): se versiona con git, se revisa como cualquier cambio y la comparte todo el equipo. Nada sale de tu equipo.

```
.tutti/
├─ README.md
├─ docs/       documentación por categorías (tutorials, how-to, reference, explanation)
├─ steering/   contexto.md y las guías para los agentes (product.md, tech.md…)
├─ hooks/      un .json por hook (formato de Kiro)
├─ roles.json  el plan de roles en curso (lo escribe el agente líder)
└─ skills/     una carpeta por skill, con su SKILL.md
```

Las **subcarpetas aparecen solo cuando añades su primer elemento**, y se crean todas desde la pestaña [Tutti](#tutti) (o a mano: Tutti lee lo que haya).

Siempre que una acción le pida algo a un agente (redactar un cambio, un hook, una skill o el steering base, ejecutar tareas…), puedes **elegir el agente**: uno de los que ya tienes abiertos, que recibe la petición en su panel, o cualquiera de los instalados, que Tutti **abre con la petición como tarea inicial**. Por defecto va al agente activo, o al primero instalado si no hay ninguno abierto.

### Specs con OpenSpec

![El formulario para proponer un cambio](img/spec-formulario.png)

Las specs usan **OpenSpec** y viven fuera de `.tutti`, en la carpeta `openspec/` de la raíz del proyecto, que es donde la busca su CLI. Si no lo tienes instalado, la sección te muestra el comando (`npm install -g @fission-ai/openspec@latest`) con un botón para copiarlo. Después, **Iniciar OpenSpec** crea `openspec/` con su `config.yaml`, `specs/` y `changes/`; no instala nada en tus agentes.

- `openspec/specs/<capacidad>/spec.md`: lo que el sistema hace *hoy*, como requisitos («### Requirement: …») con sus escenarios (`WHEN` / `THEN`).
- `openspec/changes/<cambio>/`: un cambio en marcha, con `proposal.md` (por qué y qué cambia), `specs/` (lo que añade, modifica o quita: «## ADDED / MODIFIED / REMOVED Requirements»), `design.md` y `tasks.md` (casillas `- [ ]`).
- `openspec/changes/archive/`: los cambios terminados. Al archivar uno, sus deltas se funden en `openspec/specs`.
- `openspec/config.yaml`: el *schema* (por defecto `spec-driven`), el contexto del proyecto y las reglas por artefacto. Se abre desde la sección.

El **+** abre el formulario *Proponer un cambio*: un nombre (será la carpeta), qué quieres cambiar y quién redacta los archivos. Con *plantillas* se crean `proposal.md`, un delta de spec, `design.md` y `tasks.md` con su estructura; con *pedírselo al agente*, el agente abierto los rellena, sin escribir código todavía, y ejecuta `openspec validate --strict` al terminar.

Cada cambio de la lista muestra su avance (`2/5`) y, al pasar el ratón, tres acciones:

| Acción | Qué hace |
|---|---|
| **Implementar con el agente** | Le pide al agente abierto que lea la propuesta, las specs, el diseño y las tareas y trabaje `tasks.md` en orden, marcando cada casilla al terminar |
| **Validar** | Ejecuta `openspec validate <cambio> --strict` y avisa si algo no cumple el formato |
| **Archivar** | Solo con todas las tareas hechas: mueve el cambio a `archive/` y actualiza las specs vigentes |

### docs/

La documentación sigue **Diátaxis**: `tutorials` (aprender haciendo), `how-to` (resolver una tarea), `reference` (descripción exacta) y `explanation` (el porqué). Solo se ven las categorías que ya tienen documentos; al crear uno eliges su categoría. Si aún no hay una `overview.md` (la visión general), un botón la crea con su esqueleto y le pide al agente abierto que la rellene explorando el proyecto.

### steering/

![El formulario para crear un steering](img/steering-formulario.png)

`contexto.md` es el contexto del proyecto (ver [Contexto del proyecto](#contexto)). El resto son guías al estilo del **steering de Kiro**: una cabecera opcional (`---` … `---`) dice cuándo se entregan al agente.

| Modo | Qué hace |
|---|---|
| `inclusion: always` (por defecto) | Se entrega entero en cada sesión |
| `inclusion: fileMatch` + `fileMatchPattern` | Entero si hay cambios en archivos que coinciden con el patrón (uno o una lista); si no, solo se lista |
| `inclusion: manual` | No se copia: se lista con su ruta para que el agente la lea cuando la menciones |
| `inclusion: auto` + `name` y `description` | No se copia: se lista con su descripción para que el agente la lea cuando venga al caso |

```
---
inclusion: fileMatch
fileMatchPattern: ["src/components/**/*.tsx"]
---

# Componentes
Usa componentes de función. Contrato de la API: #[[file:openapi.yaml]]
```

Las guías «solo listadas» cuestan pocos tokens: el agente ve su nombre, descripción y ruta, y abre la que le sirva. Dentro del texto puedes enlazar archivos reales con `#[[file:ruta]]`, `#[[file:ruta:12-28]]` (un rango de líneas) o `#[[folder:ruta]]`; se sustituyen por su contenido al entregarlo y nunca salen del proyecto. Los **archivos base** de Kiro (`product.md`, `tech.md`, `structure.md`) se crean de golpe desde el formulario, y el agente puede rellenarlos explorando el proyecto. El panel «Lo que reciben los agentes» del Contexto muestra cuánto pesa cada guía.

**Steering global:** en el formulario puedes elegir *Todos mis proyectos*. Esas guías se guardan en la configuración de Tutti (fuera de cualquier repositorio) y valen en todos tus proyectos; si el proyecto tiene un archivo con el mismo nombre, manda el del proyecto. Sus referencias `#[[file:…]]` se resuelven desde la carpeta de los globales. Aparecen en la lista con la etiqueta «Global».

### hooks/

![El diálogo para elegir cómo crear un hook](img/hook-opciones.png)

![Describir el hook y elegir el agente](img/hook-agente.png)

![El formulario para crear un hook](img/hook-formulario.png)

El **+** abre un diálogo con dos opciones, como el de Kiro: **Crear un hook** (un formulario guiado, en una pestaña del editor, con nombre, evento, filtro y acción) o **Pedírselo al agente** (describes el hook con tus palabras y un agente escribe el JSON: te lo enseña y lo guarda apagado hasta que lo apruebes). El lápiz de cada hook lo abre en el mismo formulario para **editarlo** sin tocar el JSON; el resto de hooks del archivo y su interruptor se respetan.

Un hook es un archivo `.tutti/hooks/<nombre>.json` en el **formato de Kiro**: `version`, una lista `hooks` y, en cada uno, `name`, `description`, `trigger`, `matcher` (expresión regular sobre la ruta), `action` (`command` o `agent`), `timeout` (segundos, 60 por defecto) y `enabled`. Un archivo puede tener varios.

```
{ "version": "v1", "hooks": [{
    "name": "Lint al guardar", "trigger": "PostFileSave", "matcher": "\\.(ts|tsx)$",
    "action": { "type": "command", "command": "npx eslint --fix $TUTTI_HOOK_FILE" }
}] }
```

- `PostFileSave` se dispara cuando se guarda un archivo del proyecto (por ti o por un agente). Con `command`, Tutti ejecuta el comando en la raíz con el contexto en JSON por stdin y el archivo en `$TUTTI_HOOK_FILE`; con `agent`, escribe el prompt en el agente abierto. El resultado sale como aviso.
- `PreToolUse`, `PostToolUse` y `Stop` se leen y se muestran (en ámbar), pero Tutti no los ejecuta: son eventos de la sesión interna de cada agente.
- Como un hook ejecuta comandos del repositorio, **no corre hasta que lo permites**: al pulsar el interruptor de un hook, Tutti te pide permitir los hooks en este proyecto; hasta entonces solo se listan, con el interruptor apagado. Cada hook tiene su interruptor, y un hook que reescribe el archivo no se vuelve a disparar en bucle.

### skills/

![El formulario para crear una skill](img/skill-formulario.png)

Una skill es una carpeta con un `SKILL.md` que empieza con una cabecera (`name` y `description`) y sigue con las instrucciones. El formulario pide el **nombre** (la carpeta, en minúsculas con guiones), **qué hace y cuándo usarla** (la descripción, por la que el agente la elige; es obligatoria) y, si quieres, las **instrucciones**; vacías, se crea un esqueleto corto (cuándo usarla, pasos y notas). También puedes pedirle al agente abierto que las redacte, o **importar una skill que ya tengas** (una carpeta con su `SKILL.md`): se copia entera a `.tutti/skills`, sin pisar ninguna y sin `.git` ni `node_modules`.

<a id="mcp"></a>

## Servidores MCP y tienda

Lee, añade y quita los servidores de **Claude Code, OpenCode, Gemini CLI, Qwen Code, Cursor Agent, Codex y Antigravity** (globales, del proyecto y `.mcp.json`) usando la CLI de cada agente para respetar su formato. Cursor Agent no tiene `mcp add`: Tutti escribe directamente su `.cursor/mcp.json`, conservando el resto del archivo.

![Servidores MCP](img/mcp.png)

- **Un servidor, una tarjeta.** Al abrirla ves en qué agentes está aplicado (*Aplicado en*), su comando o URL, cabeceras y variables (los secretos ocultos hasta que lo pides) y dónde se guarda. Puedes copiarlo a otro agente o quitarlo de uno solo.
- La papelera de la tarjeta lo quita de todos los agentes, pidiendo confirmación.
- **+** abre *Añadir servidor MCP*: remoto (URL y cabeceras) o local (comando, argumentos y variables), los agentes de destino y el alcance (todos los proyectos o solo este). Codex y Antigravity solo guardan servidores globales.
- Las secciones *Tutti*, *Instalados*, *Recomendados* y *Disponibles* se pliegan y recuerdan su estado.

![Detalle de un servidor](img/mcp-detalles.png)

### Gestionar un servidor

Al abrir la tarjeta de un servidor:

- **Probar** lo arranca (o llama a su URL) como lo haría un agente y muestra si conecta, cuánto tarda y qué **herramientas** ofrece. Tiene un tope de 20 s; un servidor que usa OAuth no se puede probar desde aquí, porque eso lo autoriza el agente.
- **Editar** cambia el comando, la URL, los argumentos, las variables o las cabeceras en todos los agentes donde está (el nombre no se puede cambiar). Si el cambio falla, deja el anterior.
- El **interruptor** de cada agente lo **desactiva** sin perder su configuración: Tutti lo quita del agente y guarda cómo estaba en sus ajustes (no en el proyecto, porque puede llevar secretos). Sale atenuado en la lista y puedes **activarlo** cuando quieras.

### Sincronizar entre agentes

Tutti no inventa otro formato: la **fuente es Claude Code** —el `.mcp.json` del proyecto y sus MCP de usuario para los globales— y compara con ella cada agente instalado. La sección **Sincronizar** (una sola, con *Proyecto* y *Global* dentro) marca por servidor y agente si está *igual*, *falta*, es *distinto* o está *desactivado*, y solo lista lo que necesita atención.

- **Añadir lo que falta** copia a cada agente lo que no tiene (siempre visible; desactivado si no hay nada que copiar).
- **Traer N de otros agentes** (en lo global) pasa a la fuente lo que solo existe en otro.
- Un servidor *distinto* se resuelve con **Usar el de Claude** (el agente pasa a lo que dice la fuente) o **Usar el del agente** (la fuente se actualiza con lo del agente).
- **Estandarizar los N MCP locales** (en el proyecto) pasa a `.mcp.json` los MCP locales de Claude y los que solo están en otros agentes, para compartirlos con el equipo. Los que llevan **claves o tokens** no se mueven (`.mcp.json` se versiona): se quedan donde estaban y el aviso los lista.

Dónde guarda cada agente sus MCP de proyecto (`.mcp.json` solo lo lee, que se sepa, Claude Code):

| Agente | Proyecto | Cómo recibe lo de `.mcp.json` |
|---|---|---|
| Claude Code | `.mcp.json` (compartido) o tu `~/.claude.json` (local) | Es la fuente |
| OpenCode | `opencode.json` | Al abrirlo desde Tutti, por proceso: no hace falta ese archivo |
| Gemini CLI | `.gemini/settings.json` | Se le escribe su archivo |
| Qwen Code | `.qwen/settings.json` | Se le escribe su archivo |
| Cursor Agent | `.cursor/mcp.json` | Se le escribe su archivo |
| Codex, Antigravity | — | Solo globales |

> [!NOTE]
> Al **estandarizar**, de `opencode.json` se quitan los servidores que ya están *iguales* en `.mcp.json`; si el archivo solo tenía MCP, se borra, y si tiene más ajustes (tema, permisos…), se conserva. Los que allí están distintos no se tocan y el aviso los lista. **Contrapartida:** OpenCode solo recibe esos MCP cuando lo abres desde Tutti; en una terminal normal no los tendrá.

### Tienda

El buscador de arriba consulta el **registro oficial de MCP** (`registry.modelcontextprotocol.io`) con el aspecto de las extensiones de VS Code: icono, nombre, descripción, quién lo publica, si es local o remoto y el botón **Instalar**. Los más conocidos (Context7, Playwright, GitHub, Chrome DevTools, Notion, Figma, Linear, Atlassian, Sentry, Supabase, Stripe, Cloudflare, Vercel, Serena) salen primero en **Recomendados**; al buscar, lo que mejor coincide va arriba.

![Tienda de servidores](img/mcp-tienda.png)

1. Al pulsar un servidor se abre su **ficha**: qué es, quién lo publica, versión, repositorio, el comando exacto que se ejecutará y las variables que pide.
2. *Continuar* abre *Añadir servidor MCP* ya relleno; completas lo que falte y eliges los agentes.

![Ficha de un servidor](img/mcp-ficha.png)

![Instalar con los datos rellenos](img/mcp-instalar.png)

Solo se ofrece lo que Tutti sabe instalar: paquetes **npm** (con `npx`), **pypi** (con `uvx`) y servidores **remotos** por URL (`streamable-http` o `sse`). Necesitas `node` o `uv` instalados para los locales.

> [!WARNING]
> Instalar un servidor MCP ejecuta código de terceros en tu equipo y el registro no lo revisa. Comprueba el comando y de dónde viene antes de continuar. Sin conexión, la tienda muestra un aviso con *Reintentar*; lo ya instalado sigue funcionando.

<a id="consumo"></a>

## Consumo e historial

El apartado **Consumo** (`Ctrl`+`Shift`+`U`) muestra, por agente instalado:

- Los **tokens** de la ventana de 5 h de Claude, de hoy, de 7 días y totales.
- Los **porcentajes reales de límite** que da Anthropic (sesión de 5 h, semanal, por modelo) y cuándo se reinician. Se consultan una vez al abrir la pestaña, con la sesión de Claude Code; si caducó, basta abrir Claude Code una vez.
- De **Codex**, los tokens de hoy, de 7 días y totales, el porcentaje de su límite y cuándo se reinicia; todo se lee de los registros locales de `~/.codex`, sin red.
- El consumo de OpenCode, y de **Antigravity** el historial de conversaciones (no guarda tokens en local).

### Historial del proyecto

Lista las sesiones de IA del proyecto abierto. Desde el menú de cada una puedes **retomarla** (en los agentes que lo permiten), **renombrarla** (solo cambia el nombre que ves en Tutti) o **borrarla**; también hay *Borrar historial* para todas.

<a id="git"></a>

## Git

![Cambios y commit](img/git.png)

### Cambios y commit

- **Cambios** con preparar / quitar, y secciones *preparados* y *cambios* que se pliegan. Al pulsar un archivo se abre su comparación.
- **Descartar cambios:** el botón ↶ de cada archivo de *cambios* (o el de la cabecera, para todos) deshace los cambios sin preparar, pidiendo confirmación. Los archivos nuevos van a la **papelera** y se pueden recuperar; lo ya preparado no se toca.
- **Mensaje de commit con IA.** La ✨ del campo le pide a un agente instalado un mensaje en [Conventional Commits](https://www.conventionalcommits.org) a partir de *lo que tienes preparado*, y lo deja para que lo revises. Se ve qué agente lo redacta. Si ninguno responde, se arma con reglas sencillas sobre los archivos tocados.
- **Un solo botón, un paso por pulsación.** Con mensaje hace *Commit*; después pasa a *Push* o, si faltan cambios del remoto, a *Pull* (solo avance simple, nunca une a ciegas), con una animación del progreso. Sin repositorio remoto solo ofrece commit. Funciona también en un repositorio recién creado, sin commits.

### Ramas

`Ctrl`+`Shift`+`G` abre Git; el chip con el nombre de la rama, en la barra de título, abre el selector: un panel al estilo de VS Code con la fecha y el último commit de cada rama, búsqueda, cambio de rama (local o remota), **crear** una nueva (desde la actual o *a partir de…* otra) y *desproteger* para ir a una rama o commit sin crear rama.

![Selector de ramas](img/ramas.png)

### Comparar cambios

Una pestaña con la **comparación en dos columnas** (lo anterior a la izquierda, lo nuevo a la derecha), con las líneas añadidas y borradas resaltadas y los tramos largos sin cambios plegados.

![Comparación de cambios](img/comparacion.png)

### Commits

El chip **Commits** abre el **grafo de todas las ramas**, con las etiquetas de rama, remota y tag, los merges atenuados y una fila de *cambios sin commit* que lleva a la sección Git.

- **Clic en un commit:** debajo salen sus datos y los archivos que cambió con `+N −N`; en un merge, lo que trajo la rama unida. Al pulsar un archivo se abre su comparación.
- **Clic derecho:** etiqueta, crear rama aquí, cambiar de rama, cherry-pick, revertir, unir (con *no-ff*, *squash* y *no commit*), rebase, reset (suave, mixto o duro) y copiar hash o mensaje. Las operaciones que cambian el historial piden confirmación, y si dan conflictos se cancelan sin dejar el repositorio a medias.

![Grafo de commits](img/commits.png)

<a id="apariencia"></a>

## Apariencia e idioma

La tuerca de abajo en la barra lateral abre los ajustes, con dos submenús que se abren al pasar el ratón (muestran el valor actual):

- **Tema:** oscuro, claro o *Automático* (sigue al del sistema). El claro usa tonos suaves, sin blanco puro, para no cansar la vista. Cambia también el editor, los colores del código y las terminales.
- **Idioma:** *Español*, *Inglés* o *Automático* (el del sistema; si no es español, inglés). Cambia toda la interfaz al instante y se recuerda. El contexto del proyecto y los mensajes de error también salen en tu idioma, y la IA redacta el contexto en él.

![Ajustes](img/ajustes.png)

![Tema claro](img/tema-claro.png)

Los textos de la interfaz están en `src/shared/locales/es.json` y `en.json`; si falta una clave en inglés, no compila.

<a id="atajos"></a>

## Atajos de teclado

`F1` muestra la lista dentro de la app. Los atajos globales llevan `Ctrl`+`Shift` para no chocar con las teclas que usan los agentes y las shells.

| Atajo | Acción |
|---|---|
| `Ctrl`+`S` / `Ctrl`+`W` | Guardar / cerrar el archivo abierto |
| `Ctrl`+`F` / `Ctrl`+`H` | Buscar / reemplazar en el archivo abierto |
| `Ctrl`+`Espacio` | Pedir autocompletado |
| `Ctrl`+`L` | Enviar la selección (o la línea) al agente activo |
| `Ctrl`+`Shift`+`F` / `H` | Buscar / buscar y reemplazar en el proyecto |
| `Ctrl`+`Shift`+`L` | Permitir o bloquear la edición |
| `Ctrl`+`Shift`+`N` | Abrir un agente |
| `Ctrl`+`Shift`+`T` | Mostrar u ocultar la terminal |
| `Ctrl`+`Shift`+`W` | Cerrar el panel activo |
| `Ctrl`+`AvPág` / `RePág` | Panel siguiente / anterior |
| `Ctrl`+`Shift`+`B` | Mostrar u ocultar la barra lateral |
| `Ctrl`+`Shift`+`E` · `A` · `G` · `J` · `K` · `X` · `U` | Archivos · Agentes · Git · Tutti · Contexto · MCP · Consumo |
| `Ctrl`+`C` / `V` | En terminales y agentes: copiar (con texto seleccionado) / pegar. También `Ctrl`+`Shift`+`C`, `Ctrl`+`Shift`+`V` y `Shift`+`Insert` |
| `Ctrl`+`Q` | Cerrar la aplicación |
| `F1` | Esta ayuda dentro de la app |

En los menús desplegables: `↑` `↓` mueven, `→` abre un submenú, `←` lo cierra, `Enter` elige y `Esc` cierra.

<a id="ajustes"></a>

## Ajustes y archivos

Tutti guarda sus datos en la carpeta de configuración del sistema: `~/.config/tutti` en Linux y `%APPDATA%\tutti` en Windows.

| Archivo | Qué contiene |
|---|---|
| `settings.json` | Los ajustes (tabla de abajo) |
| `contexto-global.md` | Tus preferencias para todos los proyectos (el contexto de cada proyecto está en su `AGENTS.md` o en `.tutti/steering/contexto.md`) |
| `mcp-bridge.mjs` | El puente que usa Antigravity para el reparto de tareas |

### Claves de `settings.json`

| Clave | Valores | Para qué sirve |
|---|---|---|
| `theme` | `dark` · `light` · `system` | Tema de la interfaz |
| `language` | `es` · `en` · `auto` | Idioma de la interfaz |
| `orchestration` | `false` desactiva | El servidor de reparto de tareas |
| `roles_approval` | `false` desactiva | Esperar tu aprobación antes de repartir un plan de roles |
| `roles_assignment` | `auto` | Que Tutti elija el agente y el modelo de cada rol según su dificultad (por defecto los eliges tú) |
| `edit_enabled` | booleano | Permiso de edición de archivos |
| `project`, `recent_projects` | rutas | El último proyecto y el historial |
| `project_configs` | objeto | La pestaña y los archivos abiertos de cada proyecto |
| `custom_agents` | lista | Los agentes que añadiste a mano |
| `collapsed`, `session_names`, `last_seen_version`, `limits_cache` | — | Secciones plegadas, nombres de sesiones, últimas novedades vistas y último dato de límites |

Casi todo se cambia desde la app; editar el archivo a mano es útil sobre todo para `orchestration`, `roles_approval` y `roles_assignment`. Las ventanas comparten el archivo.

### Lo que lee de tu equipo

Solo lectura: los registros de Claude Code (`~/.claude/projects`), su configuración MCP (`~/.claude.json`), la base de OpenCode (`~/.local/share/opencode`), los registros de Codex (`~/.codex/sessions`) y el historial de Antigravity (`~/.gemini/antigravity-cli`). Escribe en las configuraciones MCP de los agentes solo cuando tú añades o quitas un servidor (y en `~/.gemini/config/mcp_config.json` para el puente de Antigravity).

<a id="privacidad"></a>

## Privacidad y seguridad

- La app solo sale a internet para **consultar tus límites en Anthropic** (con la sesión de Claude Code; el token nunca se guarda ni se muestra), **buscar actualizaciones** en GitHub y, si abres la tienda, **consultar el registro de MCP**.
- El servidor de reparto de tareas escucha únicamente en `127.0.0.1` y exige un token distinto en cada ejecución.
- No hay cuentas, analítica ni telemetría.
- Borrar un archivo lo manda a la papelera. Las operaciones de git que cambian el historial piden confirmación.
- Los secretos de los servidores MCP se ocultan en pantalla hasta que pides verlos.

<a id="problemas"></a>

## Solución de problemas

- **No aparece mi agente en la lista**: Tutti busca el ejecutable en el `PATH`, en el de tu shell de login y en las carpetas habituales. Si está en otro sitio, usa *Añadir otro agente…* y elige el ejecutable o escribe la ruta completa.
- **El AppImage tarda en abrir**: Falta `libfuse2` (en Arch, `fuse2`). Funciona igual, solo que más despacio.
- **Windows muestra SmartScreen**: El instalador no está firmado. Pulsa *Más información → Ejecutar de todas formas*.
- **La terminal no encuentra `tutti`**: En Linux, `~/.local/bin` tiene que estar en tu `PATH` (añádelo en `~/.bashrc` o `~/.zshrc`); si descargaste el AppImage a mano, ábrelo una vez para que cree el comando. En Windows, abre una terminal nueva: las que ya estaban abiertas al instalar no ven el cambio del `PATH`.
- **Un agente no ve las herramientas de Tutti**: Ábrelo **desde Tutti** (fuera de la app no recibe la configuración de su sesión). Comprueba que `"orchestration"` no esté en `false`.
- **En Antigravity la tarjeta dice «No existe …»**: El registro apunta a una ruta vieja (por ejemplo tras mover la app de carpeta). Se repara solo al abrir Tutti con Antigravity instalado; ábrelo de nuevo.
- **La tienda no carga**: Necesita conexión al registro oficial de MCP. Pulsa *Reintentar*. Lo que ya tenías instalado sigue funcionando sin red.
- **Un servidor de la tienda no arranca**: Los locales necesitan `node` (`npx`) o `uv` (`uvx`) instalados y las variables que pida la ficha rellenas.
- **La ventana no se abre donde esperaba (Wayland)**: En Wayland es el compositor quien decide la posición; Tutti no puede forzarla. En KDE se abre en el monitor del cursor.
- **Quitar Tutti del todo**: `install.sh --uninstall`; tus ajustes siguen en `~/.config/tutti` (bórralos si quieres empezar de cero).

<a id="desarrollo"></a>

## Desarrollo

```
yarn install         # instala y recompila node-pty y better-sqlite3 para Electron
yarn dev             # con recarga en caliente
yarn test            # pruebas unitarias (vitest)
yarn typecheck
yarn dist            # empaqueta el AppImage en release/
yarn dist:win        # empaqueta el instalador de Windows (hay que ejecutarlo en Windows)
```

Si tu terminal define `ELECTRON_RUN_AS_NODE` (algunos editores lo hacen), `yarn dev` ya la quita por ti.

```
src/
  main/        proceso principal (index.ts: ventana y rutas IPC)
    services/    la lógica, una carpeta por tema:
      agents/      detección, terminales (node-pty), reparto de tareas (servidor MCP) y su arranque
      git/         git y el mensaje de commit con IA
      context/     contexto del proyecto, .tutti y su generación
      usage/       consumo e historial de cada agente
      mcp/         MCP de los agentes y la tienda
                   (y aquí: archivos, búsqueda, ajustes, actualizador)
    utils/       idioma de los mensajes, versión, ruta del shell, autotest
  preload/     el puente seguro hacia la interfaz (window.api)
  renderer/    interfaz en React + Tailwind (features/ por tema, shared/ y estado con zustand)
  shared/      tipos compartidos y textos (locales/es.json, en.json)
test/          pruebas (vitest) y capture.ts, el modo de capturas
resources/     ícono de la app
scripts/       dev.mjs
```

### Herramientas de depuración (variables de entorno)

| Variable | Qué hace |
|---|---|
| `TUTTI_MCP_LOG=1` | Imprime cada petición que reciben los servidores MCP |
| `TUTTI_SELFTEST=1` | Prueba el reparto de tareas de punta a punta con agentes falsos |
| `TUTTI_CAPTURE=<carpeta>` | Abre la app con ajustes aislados, recorre las pantallas y guarda una captura de cada una |
| `TUTTI_CAPTURE_LANG=en` · `_LIGHT=1` · `_INTERNAL=1` | Con la captura: idioma, tema claro y colocar la ventana en la pantalla integrada |
| `TUTTI_CAPTURE_NEW` · `_TUTTI` · `_GRAPH` · `_DIFF=<archivo>` · `_MCP` · `_UPDATE` | Con la captura: añade esas pantallas |
| `TUTTI_CAPTURE_REAL=1` | Lanza **agentes reales** (Claude Code) para la imagen principal; gasta tokens |

### Publicar una release

1. Sube `version` en `package.json` y añade su sección `## x.y.z` a `CHANGELOG.md` y a `CHANGELOG.en.md`; haz commit.
2. `git tag vX.Y.Z && git push origin master vX.Y.Z`.

GitHub Actions comprueba que el tag coincide con la versión y que los dos changelogs la mencionan, pasa tipos y pruebas, empaqueta el AppImage y el instalador de Windows y crea la release (`Tutti-X.Y.Z-x86_64.AppImage`, `latest-linux.yml`, `install.sh`, `Tutti-Setup-X.Y.Z.exe` y `latest.yml`, que es lo que lee el actualizador). Si el build de Windows falla, la de Linux sale igual.

### Créditos

Tutti se ha construido con la ayuda de [Claude](https://claude.com/claude-code) (Anthropic) y [Codex](https://openai.com/codex) (OpenAI), que han colaborado en el código, las pruebas, las capturas y esta documentación. Las decisiones de producto y la revisión de cada cambio son de quien mantiene el proyecto.

<a id="contribuir"></a>

## Contribuir

Tutti es de código abierto (MIT) y cualquier ayuda suma: un error bien descrito, una traducción, una mejora de esta documentación o código. Si te gusta, [una estrella en GitHub](https://github.com/cyansaju-sys/tutti) ayuda a que más gente lo encuentre.

### Cómo participar

1. **Busca primero** en los [issues](https://github.com/cyansaju-sys/tutti/issues); puede que ya exista. Al abrir uno, elige la plantilla de *error* o de *idea*.
2. **Cambios grandes** (una pantalla nueva, cambiar cómo funciona algo, añadir dependencias): abre un issue y cuéntalo antes de escribir código.
3. **Cambios pequeños** (un arreglo, un texto, una prueba): directo a un pull request.
4. **Vulnerabilidades:** no las publiques; escribe en privado a quien mantiene el proyecto.

### Las reglas del código

- Haz un *fork* y una rama desde `master` con un nombre claro (`fix/…`, `feat/…`, `docs/…`). Un pull request, un propósito.
- Antes de abrirlo deben pasar `yarn typecheck` y `yarn test`.
- **Imita lo que ya hay:** mismo estilo y comentarios (en español, explican el porqué).
- **Textos de la interfaz** siempre en `src/shared/locales/es.json` *y* `en.json`, con las mismas claves y variables; se usan con `t('clave')`.
- Una prueba por cada arreglo o lógica nueva, que no dependa del idioma ni de la máquina.
- Sin dependencias nuevas sin una razón clara, y sin datos personales en capturas.
- Commits en [Conventional Commits](https://www.conventionalcommits.org); si el cambio lo nota el usuario, una línea en `CHANGELOG.md` y `CHANGELOG.en.md`.
- Esta documentación se edita a mano en `docs/documentacion.md` (español) y `docs/documentacion.en.md` (inglés).

> [!NOTE]
> Puedes usar IA para colaborar, como se hizo en este proyecto. Lo importante es que entiendas y revises lo que envías; si una parte importante la escribió una IA, dilo en el pull request.

### Documentos

- [CONTRIBUTING.md](https://github.com/cyansaju-sys/tutti/blob/master/CONTRIBUTING.md): la guía completa, en español y en inglés.
- [CODE_OF_CONDUCT.md](https://github.com/cyansaju-sys/tutti/blob/master/CODE_OF_CONDUCT.md): respeto y buen trato; críticas al código, no a la persona.
