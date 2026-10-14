import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { codexEntries } from '../../../../src/main/services/mcp/mcp'
import { agyPluginConfig, agyPluginsJson, agyProjectPlugin, codexProjectConfig, declarePluginsDir, dropCodexBridgeCopy, launchedName, LAUNCHER_PATH, mirrorToAgy, mirrorToCodex, pluginEntry, resolveEntry } from '../../../../src/main/services/mcp/mirror'

const project = (servers: Record<string, unknown>): string => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tutti-agy-')))
  writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: servers }))
  return root
}
const config = (root: string): Record<string, unknown> => JSON.parse(readFileSync(agyPluginConfig(root), 'utf8')).mcpServers

describe('plugin de Antigravity como espejo de .mcp.json', () => {
  it('locales por el lanzador, remotos con su URL', () => {
    expect(pluginEntry('loc', { command: 'npx' })).toEqual({ command: 'node', args: ['${PLUGIN_ROOT}/../../mcp/launch.mjs', 'loc'] })
    expect(pluginEntry('api', { type: 'http', url: 'https://x/mcp', headers: { A: 'b' } })).toEqual({ url: 'https://x/mcp', headers: { A: 'b' } })
    expect(launchedName(pluginEntry('loc', { command: 'npx' }))).toBe('loc')
    expect(launchedName({ command: 'npx' })).toBeNull()
  })
  it('se muestra la configuración de .mcp.json', () => {
    expect(resolveEntry(pluginEntry('loc', {}), { loc: { command: 'npx' } })).toEqual({ command: 'npx' })
    expect(resolveEntry(pluginEntry('loc', {}), {})).toEqual(pluginEntry('loc', {}))
  })
  it('pone, conserva lo ajeno y quita lo que ya no está en .mcp.json', () => {
    const root = project({ loc: { command: 'npx' } })
    mkdirSync(agyProjectPlugin(root), { recursive: true })
    writeFileSync(agyPluginConfig(root), JSON.stringify({ mcpServers: { mio: { command: 'x' } } }))
    mirrorToAgy(root, 'loc')
    expect(Object.keys(config(root)).sort()).toEqual(['loc', 'mio'])
    expect(existsSync(join(root, LAUNCHER_PATH))).toBe(true)
    writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: {} }))
    mirrorToAgy(root, 'loc')
    expect(Object.keys(config(root))).toEqual(['mio'])
  })
  it('declara .tutti/plugins en .agents/plugins.json una sola vez, sin pisar lo que haya', () => {
    const root = project({})
    mkdirSync(join(root, '.agents'))
    writeFileSync(agyPluginsJson(root), JSON.stringify({ inherits: [{ path: '~/x.json' }], entries: [{ path: 'otros' }] }))
    declarePluginsDir(root)
    declarePluginsDir(root)
    expect(JSON.parse(readFileSync(agyPluginsJson(root), 'utf8'))).toEqual({ inherits: [{ path: '~/x.json' }], entries: [{ path: 'otros' }, { path: '.tutti/plugins' }] })
  })
  it('quita el plugin de las primeras versiones en .agents/plugins (solo si es el de Tutti)', () => {
    const root = project({ loc: { command: 'npx' } })
    for (const [dir, name] of [['tutti-mcp', 'tutti-mcp'], ['otro', 'otro']]) {
      mkdirSync(join(root, '.agents', 'plugins', dir), { recursive: true })
      writeFileSync(join(root, '.agents', 'plugins', dir, 'plugin.json'), JSON.stringify({ name }))
    }
    mirrorToAgy(root, 'loc', true)
    expect(existsSync(join(root, '.agents', 'plugins', 'tutti-mcp'))).toBe(false)
    expect(existsSync(join(root, '.agents', 'plugins', 'otro'))).toBe(true)
  })
  it('el lanzador arranca el servidor de .mcp.json desde la raíz, con sus variables', () => {
    const script = `process.stdout.write(JSON.stringify({ cwd: process.cwd(), a: process.env.A, args: process.argv.slice(1) }))`
    const root = project({ loc: { command: process.execPath, args: ['-e', script, '${HOME_X:-def}'], env: { A: '1' } } })
    mirrorToAgy(root, 'loc', true)
    const out = execFileSync(process.execPath, [join(root, LAUNCHER_PATH), 'loc'], { cwd: tmpdir(), encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
    expect(JSON.parse(out)).toEqual({ cwd: root, a: '1', args: ['def'] })
  })
})

describe('.codex/config.toml del proyecto como espejo de .mcp.json', () => {
  it('pone locales por el lanzador y remotos con cabeceras, conservando el resto del archivo', () => {
    const root = project({ loc: { command: 'npx' }, 'mi api': { type: 'http', url: 'https://x/mcp', headers: { A: 'b' } } })
    mkdirSync(join(root, '.codex'))
    writeFileSync(codexProjectConfig(root), 'model = "o3"\n\n[mcp_servers.otro]\ncommand = "x"\n')
    mirrorToCodex(root, 'loc')
    mirrorToCodex(root, 'mi api')
    mirrorToCodex(root, 'loc')                                       // repetirlo no lo duplica
    const text = readFileSync(codexProjectConfig(root), 'utf8')
    expect(text.startsWith('model = "o3"')).toBe(true)
    expect(text.match(/\[mcp_servers\.loc\]/g)).toHaveLength(1)
    expect(Object.fromEntries(codexEntries(codexProjectConfig(root)))).toEqual({
      otro: { command: 'x' },
      loc: { command: 'node', args: [LAUNCHER_PATH, 'loc'] },
      'mi api': { url: 'https://x/mcp', headers: { A: 'b' } }
    })
    expect(existsSync(join(root, LAUNCHER_PATH))).toBe(true)
  })
  it('quita lo que ya no está en .mcp.json, con sus subtablas', () => {
    const root = project({ api: { type: 'http', url: 'https://x/mcp', headers: { A: 'b' } } })
    mirrorToCodex(root, 'api', true)
    writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: {} }))
    mirrorToCodex(root, 'api')
    expect(codexEntries(codexProjectConfig(root))).toEqual([])
  })
})

describe('copia del puente «tutti» en el config.toml de Codex', () => {
  const file = (text: string): string => { const f = join(realpathSync(mkdtempSync(join(tmpdir(), 'tutti-codex-'))), 'config.toml'); writeFileSync(f, text); return f }
  it('quita la copia stdio del puente (con su env) y deja lo demás', () => {
    const f = file('model = "o3"\n\n[mcp_servers.tutti]\ncommand = "/x/Tutti.AppImage"\nargs = ["/y/mcp-bridge.mjs"]\n\n[mcp_servers.tutti.env]\nELECTRON_RUN_AS_NODE = "1"\n\n[mcp_servers.otro]\ncommand = "z"\n')
    expect(dropCodexBridgeCopy(f)).toBe(true)
    expect(codexEntries(f).map(([n]) => n)).toEqual(['otro'])
    expect(readFileSync(f, 'utf8').startsWith('model = "o3"')).toBe(true)
  })
  it('no toca una entrada «tutti» que no es el puente', () => {
    const f = file('[mcp_servers.tutti]\nurl = "http://x/mcp"\n')
    expect(dropCodexBridgeCopy(f)).toBe(false)
    expect(codexEntries(f).map(([n]) => n)).toEqual(['tutti'])
  })
})
