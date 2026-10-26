/**
 * Modo captura: TUTTI_CAPTURE=<carpeta> abre la app con una configuración temporal, recorre las pantallas,
 * guarda un PNG de cada una y cierra. Sirve para regenerar las capturas de la documentación.
 */
import { app, screen, type BrowserWindow } from 'electron'
import * as pty from '../src/main/services/agents/pty'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { legacyContextFile } from '../src/main/services/context/context'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export async function runCapture(win: BrowserWindow, outDir: string, project: string): Promise<void> {
  mkdirSync(outDir, { recursive: true })
  const run = (code: string): Promise<unknown> => win.webContents.executeJavaScript(code)
  const snap = async (name: string, wait = 900): Promise<void> => {
    await sleep(wait)
    const image = await win.webContents.capturePage()
    writeFileSync(join(outDir, `${name}.png`), image.toPNG())
    console.log('capturada', name)
  }
  const store = 'window.__tutti.getState()'
  // los archivos de ejemplo salen del propio proyecto: el de Tutti si es su repositorio, o los de cualquier otro (p. ej. una app de tareas)
  const pick = (...files: string[]): string => files.find((f) => existsSync(join(project, f))) ?? files[files.length - 1]
  const isTutti = existsSync(join(project, 'src/main/services/git/git.ts'))
  const MAIN = pick('src/main/services/git/git.ts', 'app.js'), SECOND = pick('docs/demo/Contador.tsx', 'logic.js'), THIRD = pick('docs/demo/ejemplo.sql', 'style.css')
  const TERM = isTutti ? ['agente', 'asistente'] : ['tarea', 'pendiente']
  const open = (file: string): Promise<unknown> => (existsSync(join(project, file)) ? run(`${store}.openDoc(${JSON.stringify(join(project, file))})`) : Promise.resolve())
  // TUTTI_CAPTURE_INTERNAL=1: en la pantalla integrada (si hay varias) y ocupando su área útil; si no, un tamaño fijo
  const internal = process.env.TUTTI_CAPTURE_INTERNAL ? screen.getAllDisplays().find((d) => d.internal) : undefined
  if (internal) win.setBounds(internal.workArea)
  else win.setContentSize(1360, 860)
  await sleep(1500)
  await run(`${store}.setProject(${JSON.stringify(project)})`)
  await run(`${store}.set({ tab: 'files' })`)
  if (process.env.TUTTI_CAPTURE_LANG) await run(`${store}.setLang(${JSON.stringify(process.env.TUTTI_CAPTURE_LANG)})`)         // idioma de las capturas (es | en)
  if (process.env.TUTTI_CAPTURE_LIGHT) await run(`${store}.setTheme('light')`)         // todas las capturas en tema claro
  if (process.env.TUTTI_CAPTURE_TERMINAL) {          // solo para verificar la terminal sola, ocupando todo el espacio
    await run(`${store}.toggleShell()`)
    await snap('terminal-sola', 2500)
    await run(`${store}.toggleShell()`)
  }
  await open(MAIN)
  await snap('01-archivos-y-editor', 1800)
  await open(SECOND)
  await snap('02-sintaxis-tsx')
  // tema claro, y el menú de ajustes de la barra lateral
  await run(`${store}.setTheme('light')`)
  await snap('02b-tema-claro', 900)
  await run(`${store}.set({ tab: 'agents' })`)
  await run(`document.querySelector('[title="${process.env.TUTTI_CAPTURE_LANG === 'en' ? 'Settings' : 'Ajustes'}"]')?.click()`)
  await snap('02c-ajustes', 500)
  await run(`[...document.querySelectorAll('[role="menuitem"]')].find((b) => /Idioma|Language/.test(b.textContent))?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))`)      // el submenú de idioma se abre al pasar el ratón
  await snap('02d-idioma', 500)
  await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)          // cierra el submenú
  await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)          // y el menú
  await run(`${store}.set({ tab: 'files' })`)
  await run(`${store}.setTheme('${process.env.TUTTI_CAPTURE_LIGHT ? 'light' : 'dark'}')`)
  await open(THIRD)
  await snap('03-sql')
  // clic derecho en el editor: enviar la selección al agente, copiar, pegar…
  await open(MAIN)
  await run(`(() => { const c = document.querySelector('.cm-content'); const r = c.querySelector('.cm-line:nth-child(9)').getBoundingClientRect(); c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 80, clientY: r.top + 6 })) })()`)
  await snap('03a-menu-editor', 600)
  await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  // buscar en el archivo abierto: Ctrl+H abre el cuadro flotante con la fila de reemplazo
  await open(MAIN)
  await run(`(() => {
    const type = (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) }
    document.querySelector('.cm-content')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true }))
    setTimeout(() => { type(document.querySelector('.tutti-find-input'), 'root'); type(document.querySelectorAll('.tutti-find-input')[1], 'raiz') }, 150)
  })()`)
  await snap('03b-buscar-en-archivo', 900)
  await run(`[...document.querySelectorAll('.tutti-find-btn')].find((b) => b.textContent === '×')?.click()`)         // cierra el cuadro de buscar del editor
  // buscar y reemplazar en el proyecto
  await run(`${store}.set({ tab: 'search', searchReplace: true, searchToken: ${store}.searchToken + 1 })`)
  await sleep(300)
  await run(`(() => {
    const type = (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) }
    const [find, repl] = document.querySelectorAll('input[placeholder="Buscar"], input[placeholder="Reemplazar"]')
    type(find, ${JSON.stringify(TERM[0])}); if (repl) type(repl, ${JSON.stringify(TERM[1])})
  })()`)
  await snap('03c-buscar-en-proyecto', 1500)
  await run(`${store}.set({ tab: 'files' })`)
  await run(`${store}.set({ tab: 'git' })`)
  await snap('04-git', 1200)
  await run(`${store}.set({ tab: 'agents' })`)
  await snap('05-agentes')
  await run(`${store}.set({ modal: 'agents' })`)
  await snap('06-elegir-agente')
  await run(`${store}.set({ modal: 'branches' })`)
  await snap('06b-ramas')
  // explorador: el campo de nombre dentro del propio árbol
  await run(`${store}.set({ modal: null, tab: 'files' })`)
  await run(`document.querySelector('[title="Nueva carpeta"]')?.click()`)
  await snap('06c-nueva-carpeta', 500)
  await run(`document.activeElement?.blur()`)
  // varias terminales: procesos `cat` (así no sale el prompt de tu shell) con un poco de texto escrito
  await run(`${store}.set({ shells: [{ id: 's1', kind: 'shell', title: 'zsh', command: 'cat', args: [], cwd: ${JSON.stringify(project)} }, { id: 's2', kind: 'shell', title: 'node', command: 'cat', args: [], cwd: ${JSON.stringify(project)} }, { id: 's3', kind: 'shell', title: 'zsh', command: 'cat', args: [], cwd: ${JSON.stringify(project)} }], shellActive: 's2', activePane: 's2' })`)
  await sleep(1800)
  pty.write('s2', '$ npm run dev\r')
  pty.write('s2', 'VITE v5 ready in 412 ms\r')
  await snap('06d-terminales', 800)
  await run(`${store}.closeShells()`)
  await run(`${store}.set({ modal: 'shortcuts' })`)
  await snap('07-atajos')
  await run(`${store}.set({ modal: null }); ${store}.toast('Commit hecho', 'ok'); ${store}.toast('No se pudo iniciar «claude»: comando no encontrado', 'error')`)
  await snap('08-avisos', 400)
  await run(`${store}.set({ toasts: [] })`)
  if (process.env.TUTTI_CAPTURE_TERMINAL) {          // solo para verificar los sub-agentes, con procesos falsos (`cat`)
    await run(`${store}.set({ docs: [], activeDoc: null, tab: 'agents' })`)
    await run(`${store}.addPane({ id: 'a1', kind: 'agent', name: 'Claude Code', title: 'Claude Code · tutti', command: 'cat', args: [], cwd: ${JSON.stringify(project)} })`)
    await run(`${store}.addPane({ id: 'a2', kind: 'agent', name: 'Claude Code', title: 'Claude Code · tutti', command: 'cat', args: [], cwd: ${JSON.stringify(project)}, parentId: 'a1' })`)
    await run(`${store}.addPane({ id: 'a3', kind: 'agent', name: 'OpenCode', title: 'OpenCode · tutti', command: 'cat', args: [], cwd: ${JSON.stringify(project)}, parentId: 'a1' })`)
    await snap('subagentes', 2000)
    await run(`${store}.set({ panes: [], activePane: null })`)
  }
  if (process.env.TUTTI_CAPTURE_TERMINAL) {          // solo para verificar: el prompt de tu shell no debe ir a la documentación
    await run(`${store}.set({ modal: null }); ${store}.toggleShell()`)
    await snap('terminal-verificacion', 2500)
  }
  if (process.env.TUTTI_CAPTURE_REAL) {              // agentes de verdad (gasta tokens): un líder arregla una función y delega las pruebas
    const dir = mkdtempSync(join(tmpdir(), 'tutti-demo-'))
    mkdirSync(join(dir, 'src')); mkdirSync(join(dir, '.claude'))
    writeFileSync(join(dir, 'package.json'), '{ "name": "demo-precios", "type": "module" }\n')
    writeFileSync(join(dir, 'src/precio.js'), '// Precio final de un artículo con su impuesto (la tasa es un porcentaje, p. ej. 15)\nexport function conImpuesto(monto, tasa) {\n  return monto + tasa\n}\n')
    // permisos solo de este proyecto de ejemplo: así ningún agente se queda esperando una confirmación
    writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ permissions: { allow: ['Read', 'Edit', 'Write', 'mcp__tutti', 'Bash(node:*)'] } }))
    execFileSync('git', ['init', '-q'], { cwd: dir })
    await run(`${store}.setProject(${JSON.stringify(dir)})`)
    await run(`${store}.set({ docs: [], activeDoc: null, tab: 'agents', modal: null })`)
    const task = 'En src/precio.js la función conImpuesto está mal: suma la tasa en vez de aplicar el porcentaje. Corrígela tú. ' +
      'Después usa delegate_task con agent "claude", difficulty "easy" y new_instance true para pedirle a otro agente que escriba src/precio.test.js ' +
      'con 3 pruebas usando node:test, espera su resultado con wait_agent y cuéntame en una frase cómo quedó. Sé breve.'
    await run(`(async () => { const id = await window.api.orchestra.newId(); window.__tutti.getState().addPane({ id, kind: 'agent', name: 'Claude Code', title: 'Claude Code · demo-precios', command: 'claude', args: [], cwd: ${JSON.stringify(dir)}, prompt: ${JSON.stringify(task)} }) })()`)
    // la carpeta es nueva: Claude pregunta si se confía en ella (la opción marcada es «No»): se baja a «Sí» y se confirma
    const answerTrust = (): void => {
      for (const m of pty.agentSessions()) {
        if (pty.screenText(m.id, 60).includes('I trust this folder')) { pty.write(m.id, '\x1b[B'); setTimeout(() => pty.write(m.id, '\r'), 400) }
      }
    }
    let calm = 0
    for (let i = 0; i < 120 && calm < 4; i++) {         // hasta que haya sub-agente y todos estén quietos (máx. ~4 min)
      await sleep(2000)
      answerTrust()
      const open = pty.agentSessions()
      calm = open.length >= 2 && open.every((m) => pty.idleFor(m.id) > 8) ? calm + 1 : 0
    }
    await snap('agentes-reales', 3000)
    console.log('carpeta de ejemplo:', dir)
    await run(`${store}.set({ panes: [], activePane: null })`)
  }
  if (process.env.TUTTI_CAPTURE_NEW) {               // inicio sin agentes, contexto del proyecto y novedades
    const tuttiSample = '# Tutti\n\n## Qué es\nPanel de escritorio (Electron + React) para trabajar con varios agentes de programación a la vez.\n\n## Estructura\n- src/main: proceso principal (agentes, git, contexto, uso)\n- src/renderer: interfaz\n- test: pruebas con vitest\n\n## Cómo se ejecuta y se prueba\n- npm run dev\n- npm test y npm run typecheck\n\n## Convenciones\n- Mensajes de commit en Conventional Commits, en español.\n'
    const sample = isTutti ? tuttiSample : '# Lista de tareas\n\n## Qué es\nAplicación web para llevar una lista de tareas: añadir, editar, filtrar y marcar como hechas, con los datos guardados en el navegador.\n\n## Estructura\n- index.html y style.css: la página\n- app.js: la interfaz\n- logic.js: la lógica, con sus pruebas en logic.test.js\n\n## Cómo se ejecuta y se prueba\n- Abrir index.html en el navegador\n- node --test logic.test.js\n'
    // el ejemplo va a la ubicación antigua (configuración aislada de la captura): así no se crea un AGENTS.md en el proyecto fotografiado
    mkdirSync(dirname(legacyContextFile(project)), { recursive: true })
    writeFileSync(legacyContextFile(project), sample, 'utf8')
    await run(`${store}.set({ modal: null, docs: [], activeDoc: null, panes: [], activePane: null, tab: 'tutti', recentProjects: ['/home/usuario/proyectos/tienda-web', '/home/usuario/proyectos/api-pagos', '/home/usuario/proyectos/tutti-docs'] })`)
    await snap('21-contexto', 1500)
    await run(`${store}.set({ tab: 'files' })`)
    await snap('22-inicio', 800)
    await run(`${store}.set({ modal: 'news', newsSince: null })`)
    await snap('23-novedades', 800)
    await run(`${store}.set({ modal: null })`)
  }
  if (process.env.TUTTI_CAPTURE_TUTTI) {             // la pestaña Tutti y un .md en vista, con un proyecto de ejemplo temporal (nada se escribe en el real)
    const dir = mkdtempSync(join(tmpdir(), 'tienda-web-'))
    const put = (file: string, text: string): void => { mkdirSync(dirname(join(dir, file)), { recursive: true }); writeFileSync(join(dir, file), text, 'utf8') }
    put('package.json', '{ "name": "tienda-web", "version": "0.4.0" }\n'); put('src/index.ts', 'export {}\n')
    put('.tutti/README.md', '# Tutti\n')
    put('openspec/config.yaml', 'schema: spec-driven\n')
    put('openspec/specs/pedidos/spec.md', '# pedidos Specification\n\n## Requirements\n\n### Requirement: Listar pedidos\nEl sistema DEBERÁ mostrar los pedidos del cliente.\n\n#### Scenario: Cliente con pedidos\n- **WHEN** el cliente abre «Mis pedidos»\n- **THEN** ve la lista, del más reciente al más antiguo\n')
    put('openspec/changes/carrito-de-compra/proposal.md', '## Why\n\nQue el cliente pueda reunir productos y pagarlos en un solo paso.\n\n## What Changes\n\n- Un carrito con total y existencias.\n\n## Capabilities\n\n### New Capabilities\n\n- `carrito`: reunir productos y pagar\n')
    put('openspec/changes/carrito-de-compra/design.md', '## Context\n\n## Decisions\n')
    put('openspec/changes/carrito-de-compra/specs/carrito/spec.md', '## ADDED Requirements\n\n### Requirement: Añadir productos\nEl sistema DEBERÁ sumar el producto al carrito y mostrar el total.\n\n#### Scenario: Añadir\n- **WHEN** el cliente pulsa «Añadir»\n- **THEN** el carrito suma el producto\n')
    put('openspec/changes/carrito-de-compra/tasks.md', '## 1. Carrito\n\n- [x] 1.1 Tipos y estado\n- [x] 1.2 Botón «Añadir»\n\n## 2. Total y existencias\n\n- [x] 2.1 Calcular el total\n- [ ] 2.2 Ocultar sin existencias\n- [ ] 2.3 Pruebas\n')
    put('openspec/changes/pagos/proposal.md', '## Why\n\nCobrar con tarjeta.\n'); put('openspec/changes/pagos/tasks.md', '## 1. Pagos\n\n- [ ] 1.1 Elegir pasarela\n- [ ] 1.2 Confirmación\n')
    put('.tutti/docs/how-to/desplegar.md', '# Cómo desplegar\n\n1. Ejecuta `npm run build`.\n2. Sube la carpeta `dist`.\n'); put('.tutti/docs/explanation/arquitectura.md', '# Arquitectura\n')
    put('.tutti/docs/reference/api.md', '# API\n')
    put('.tutti/steering/contexto.md', '# Tienda web\n\nTienda en línea con React y una API REST.\n'); put('.tutti/steering/estilo.md', '---\ninclusion: always\n---\n\n# Estilo\n\nTypeScript estricto, sin punto y coma.\n')
    put('.tutti/steering/despliegue.md', '---\ninclusion: manual\n---\n\n# Despliegue\n')
    put('.tutti/steering/api.md', '---\ninclusion: auto\nname: api-design\ndescription: Patrones de la API REST\n---\n\n# API\n')
    put('.tutti/steering/componentes.md', '---\ninclusion: fileMatch\nfileMatchPattern: "src/components/**/*.tsx"\n---\n\n# Componentes\n')
    put('.tutti/hooks/revisar.json', JSON.stringify({ version: 'v1', hooks: [{ name: 'Revisar al guardar', trigger: 'PostFileSave', matcher: '\\.(ts|tsx)$', action: { type: 'agent', prompt: 'Revisa el archivo que se acaba de guardar.' }, enabled: true }, { name: 'Lint', trigger: 'PostFileSave', matcher: '\\.ts$', action: { type: 'command', command: 'npx eslint --fix $TUTTI_HOOK_FILE' }, enabled: false }, { name: 'Resumen final', trigger: 'Stop', action: { type: 'agent', prompt: 'Resume lo que hiciste.' } }] }, null, 2))
    put('.tutti/skills/revisar-pr/SKILL.md', '---\nname: revisar-pr\ndescription: Revisa un pull request\n---\n\n# revisar-pr\n')
    execFileSync('git', ['init', '-q'], { cwd: dir })
    const recent = (await run(`${store}.recentProjects`)) as string[]                // el proyecto de ejemplo no debe quedar en la lista de recientes de las demás capturas
    await run(`localStorage.setItem('tutti.tutti.mcp.collapsed', '1')`)             // sin los servidores MCP reales del equipo que hace la captura
    await run(`${store}.setProject(${JSON.stringify(dir)})`)
    await run(`${store}.set({ modal: null, docs: [], activeDoc: null, panes: [], activePane: null, tab: 'tutti' })`)
    await sleep(1800)
    await run(`[...document.querySelectorAll('button')].filter((b) => /^(carrito-de-compra|Guías prácticas|How-to guides)/.test(b.textContent.trim())).forEach((b) => b.click())`)         // abre la spec y una categoría de la documentación
    await snap('24-tutti', 1000)
    await run(`${store}.openDoc(${JSON.stringify(join(dir, 'openspec/changes/carrito-de-compra/tasks.md'))})`)
    await run(`${store}.set({ tab: 'tutti' })`)
    await snap('25-md-vista', 1200)
    await run(`document.querySelector('button[title="${process.env.TUTTI_CAPTURE_LANG === 'en' ? 'New hook' : 'Nuevo hook'}"]')?.click()`)         // el «+» de Hooks: el diálogo con las dos opciones
    await snap('26a-hook-opciones', 600)
    await run(`[...document.querySelectorAll('[role="dialog"] button, .fixed button')].find((b) => /Pedírselo al agente|Ask the agent/.test(b.textContent))?.click()`)
    await snap('26b-hook-agente', 600)
    await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
    await run(`${store}.openHookForm()`)
    await snap('26-hook-formulario', 800)
    await run(`${store}.closeDoc('hook:new'); ${store}.openSpecForm()`)
    await run(`(() => { const t = document.querySelector('textarea'); if (t) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'Que el cliente pueda reunir productos en un carrito y pagarlos en un solo paso.'); t.dispatchEvent(new Event('input', { bubbles: true })) }; const n = document.querySelector('input[placeholder]'); if (n) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(n, 'añadir-carrito'); n.dispatchEvent(new Event('input', { bubbles: true })) } })()`)
    await snap('27-spec-formulario', 800)
    await run(`${store}.closeDoc('spec:new'); ${store}.openSteeringForm()`)
    await snap('28-steering-formulario', 800)
    await run(`${store}.closeDoc('steering:new'); ${store}.openSkillForm()`)
    await snap('29-skill-formulario', 800)
    await run(`${store}.closeDoc('skill:new')`)
    await run(`${store}.set({ tab: 'files', docs: [], activeDoc: null })`)
    await run(`${store}.setProject(${JSON.stringify(project)})`)
    await run(`${store}.set({ recentProjects: ${JSON.stringify(recent)} })`)
  }
  if (process.env.TUTTI_CAPTURE_UPDATE) {            // el botón de actualización en sus estados (el estado real lo pone el actualizador)
    await run(`${store}.set({ modal: null, tab: 'files', update: { status: 'available', version: '0.2.1', canInstall: true, url: '' } })`)
    await snap('14-actualizar-disponible', 500)
    await run(`${store}.set({ update: { status: 'downloading', version: '0.2.1', percent: 42 } })`)
    await snap('15-actualizar-descargando', 400)
    await run(`${store}.set({ update: { status: 'restarting', version: '0.2.1' } })`)
    await snap('16-actualizar-reiniciando', 400)
    await run(`${store}.set({ update: { status: 'idle' }, tab: 'files' })`)
  }
  if (process.env.TUTTI_CAPTURE_DIFF) {              // la comparación de cambios de un archivo modificado
    await run(`${store}.set({ tab: 'git', modal: null })`)
    await run(`${store}.openDiff(${JSON.stringify(join(project, process.env.TUTTI_CAPTURE_DIFF))}, false)`)
    await snap('20-comparacion', 1200)
  }
  if (process.env.TUTTI_CAPTURE_GRAPH) {             // el grafo de git del proyecto abierto
    await run(`${store}.openGraph()`)
    await snap('18-grafo', 1500)
    await run(`(() => { const rows = [...document.querySelectorAll('[title*="Clic: ver"]')]; (rows.find((e) => e.textContent.includes("Merge branch")) ?? rows[rows.length - 1])?.click() })()`)
    await snap('19-grafo-detalle', 1200)
    await run(`${store}.set({ modal: null })`)
  }
  if (process.env.TUTTI_CAPTURE_USAGE) {            // lee el consumo e historial reales del HOME
    await run(`${store}.set({ modal: null, tab: 'ai' })`)
    await snap('12-consumo', 2500)
    await run(`(() => { const b = document.querySelectorAll('[title="Más acciones"]')[0]; b?.scrollIntoView({ block: 'center' }); b?.click() })()`)
    await snap('13-consumo-menu', 500)
  }
  if (process.env.TUTTI_CAPTURE_MCP) {              // requiere servidores de ejemplo en el HOME (ver docs)
    await run(`${store}.set({ modal: null, tab: 'tutti', docs: [], activeDoc: null })`)
    await snap('09-mcp', 5000)
    await sleep(800)
    await run(`document.querySelector('[title="Ver detalles"]')?.click()`)
    await snap('10-mcp-detalles', 600)
    await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
    await sleep(300)
    await run(`document.querySelector('[title^="Añadir un servidor"]')?.click()`)
    await snap('11-mcp-anadir', 600)
  }
  app.quit()
}
