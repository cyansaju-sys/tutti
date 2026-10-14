import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe as suite, expect, it } from 'vitest'
import { addServer, buildAddArgv, codexEntries, describe, listServers, opencodeEntries, removeFromOpencodeFile, removeServer, samePath, validate } from '../../../../src/main/services/mcp/mcp'

const dir = (): string => mkdtempSync(join(tmpdir(), 'tutti-mcp-'))

suite('describir una entrada', () => {
  it('remota por url o por tipo', () => {
    expect(describe({ type: 'http', url: 'https://x/mcp' })).toEqual({ kind: 'remote', target: 'https://x/mcp' })
    expect(describe({ type: 'remote', url: 'http://y' }).kind).toBe('remote')
  })
  it('local: comando con argumentos (Claude) o lista (OpenCode)', () => {
    expect(describe({ command: 'npx', args: ['-y', 'srv'] })).toEqual({ kind: 'local', target: 'npx -y srv' })
    expect(describe({ type: 'local', command: ['npx', '-y', 'srv'] })).toEqual({ kind: 'local', target: 'npx -y srv' })
  })
})

suite('validar', () => {
  it('nombre, URL y comando', () => {
    expect(validate({ name: 'ok-1', kind: 'remote', url: 'https://a.b' })).toBeNull()
    expect(validate({ name: 'mal nombre', kind: 'remote', url: 'https://a.b' })).toContain('nombre')
    expect(validate({ name: 'x', kind: 'remote', url: 'ftp://a' })).toContain('URL')
    expect(validate({ name: 'x', kind: 'local', command: '  ' })).toContain('comando')
  })
})

suite('comando de cada agente', () => {
  const remote = { name: 'api', kind: 'remote' as const, url: 'https://x/mcp', headers: { Authorization: 'Bearer t' } }
  const local = { name: 'loc', kind: 'local' as const, command: 'npx', args: ['-y', 'srv'], env: { A: '1' } }
  it('Claude remoto: nombre antes de las opciones que aceptan varios valores', () => {
    expect(buildAddArgv('claude', remote, 'global')).toEqual(['claude', 'mcp', 'add', 'api', 'https://x/mcp', '--transport', 'http', '-s', 'user', '-H', 'Authorization: Bearer t'])
  })
  it('Claude local de proyecto', () => {
    expect(buildAddArgv('claude', local, 'project')).toEqual(['claude', 'mcp', 'add', 'loc', '-s', 'local', '-e', 'A=1', '--', 'npx', '-y', 'srv'])
  })
  it('OpenCode remoto y local', () => {
    expect(buildAddArgv('opencode', remote, 'global')).toEqual(['opencode', 'mcp', 'add', '--global', '--url', 'https://x/mcp', '--header', 'Authorization=Bearer t', 'api'])
    expect(buildAddArgv('opencode', local, 'project')).toEqual(['opencode', 'mcp', 'add', '--env', 'A=1', 'loc', '--', 'npx', '-y', 'srv'])
  })
})

suite('opencode.json', () => {
  it('lee las dos formas (2.x: mcp.servers; 1.x: mcp.<nombre>) y quita de cualquiera', () => {
    const file = join(dir(), 'opencode.json')
    writeFileSync(file, JSON.stringify({ theme: 'x', mcp: { flat: { type: 'remote', url: 'http://a' }, servers: { nuevo: { type: 'local', command: ['npx', 'a'] } } } }))
    const found = opencodeEntries(file).map(([n, , f]) => `${n}:${f}`)
    expect(found.sort()).toEqual(['flat:flat', 'nuevo:servers'])
    expect(removeFromOpencodeFile(file, 'nuevo')).toBe(true)
    expect(removeFromOpencodeFile(file, 'flat')).toBe(true)
    expect(removeFromOpencodeFile(file, 'flat')).toBe(false)
    const after = JSON.parse(readFileSync(file, 'utf8'))
    expect(after.theme).toBe('x')                                     // lo demás del archivo se conserva
    expect(opencodeEntries(file)).toEqual([])
  })
  it('un archivo inexistente o roto no da error', () => { expect(opencodeEntries(join(dir(), 'no.json'))).toEqual([]) })
})

suite('proyecto abierto por un enlace simbólico', () => {
  it('encuentra los servidores de Claude guardados bajo la ruta real', () => {
    const base = dir()
    const real = join(base, 'real', 'proyecto')
    mkdirSync(real, { recursive: true })
    symlinkSync(join(base, 'real'), join(base, 'enlace'))
    const viaLink = join(base, 'enlace', 'proyecto')
    expect(samePath(real, viaLink)).toBe(true)
    expect(samePath(real, join(base, 'otro'))).toBe(false)

    const home = join(base, 'home')
    mkdirSync(home)
    writeFileSync(join(home, '.claude.json'), JSON.stringify({ projects: { [real]: { mcpServers: { db: { type: 'stdio', command: 'npx', args: ['-y', 'srv'] } } } } }))
    const previous = process.env.HOME
    process.env.HOME = home
    try {
      const found = listServers(viaLink).filter((s) => s.agent === 'claude')
      expect(found.map((s) => `${s.name}:${s.scope}`)).toEqual(['db:project'])
    } finally { process.env.HOME = previous }
  })
})

suite('Gemini CLI y Codex', () => {
  const local = { name: 'loc', kind: 'local' as const, command: 'npx', args: ['-y', 'srv'], env: { A: '1' } }
  const remote = { name: 'api', kind: 'remote' as const, url: 'https://x/mcp', headers: { Authorization: 'Bearer t' } }
  it('arma el comando de gemini', () => {
    expect(buildAddArgv('gemini', local, 'global')).toEqual(['gemini', 'mcp', 'add', '-s', 'user', '-e', 'A=1', 'loc', 'npx', '-y', 'srv'])
    expect(buildAddArgv('gemini', remote, 'project')).toEqual(['gemini', 'mcp', 'add', '-s', 'project', '-t', 'http', '-H', 'Authorization: Bearer t', 'api', 'https://x/mcp'])
  })
  it('arma el comando de codex', () => {
    expect(buildAddArgv('codex', local, 'global')).toEqual(['codex', 'mcp', 'add', 'loc', '--env', 'A=1', '--', 'npx', '-y', 'srv'])
    expect(buildAddArgv('codex', remote, 'global')).toEqual(['codex', 'mcp', 'add', 'api', '--url', 'https://x/mcp'])
  })
  it('lee los servidores del config.toml de codex', () => {
    const file = join(dir(), 'config.toml')
    writeFileSync(file, 'model = "x"\n[mcp_servers.fs]\ncommand = "npx"\nargs = ["-y", "@a/b"]\n[mcp_servers.fs.env]\nK = "v"\n[mcp_servers."web"]\nurl = "https://w/mcp"\n[other]\ncommand = "no"\n')
    expect(codexEntries(file)).toEqual([
      ['fs', { command: 'npx', args: ['-y', '@a/b'], env: { K: 'v' } }],
      ['web', { url: 'https://w/mcp' }]
    ])
  })
  it('describe httpUrl de gemini como remoto', () => {
    expect(describe({ httpUrl: 'https://g/mcp' })).toEqual({ kind: 'remote', target: 'https://g/mcp' })
  })
})

suite('Antigravity (agy)', () => {
  it('arma el comando con las opciones antes del nombre', () => {
    expect(buildAddArgv('agy', { name: 'loc', kind: 'local', command: 'npx', args: ['-y', 'srv'], env: { A: '1' } }, 'global')).toEqual(['agy', 'mcp', 'add', '--env', 'A=1', 'loc', '--', 'npx', '-y', 'srv'])
    expect(buildAddArgv('agy', { name: 'api', kind: 'remote', url: 'https://x/mcp', headers: { Authorization: 'Bearer t' } }, 'global')).toEqual(['agy', 'mcp', 'add', '--header', 'Authorization: Bearer t', 'api', 'https://x/mcp'])
  })
  it('serverUrl cuenta como remoto', () => {
    expect(describe({ serverUrl: 'https://s/mcp' })).toEqual({ kind: 'remote', target: 'https://s/mcp' })
  })
  it('proyecto: el plugin .tutti/plugins/tutti-mcp refleja .mcp.json, se lee con la configuración de allí y se lee cualquier plugin', async () => {
    const root = dir()
    writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: { loc: { type: 'stdio', command: 'npx', args: ['-y', 'srv'], env: { A: '1' } }, api: { type: 'http', url: 'https://x/mcp' } } }))
    mkdirSync(join(root, '.agents', 'plugins', 'otro'), { recursive: true })
    writeFileSync(join(root, '.agents', 'plugins', 'otro', 'mcp_config.json'), JSON.stringify({ mcpServers: { ajeno: { command: 'a' } } }))
    // ya en .mcp.json: no se toca, solo se refleja
    expect((await addServer('agy', { name: 'loc', kind: 'local', command: 'npx', args: ['-y', 'srv'], env: { A: '1' } }, 'project', root)).ok).toBe(true)
    expect((await addServer('agy', { name: 'api', kind: 'remote', url: 'https://x/mcp' }, 'project', root)).ok).toBe(true)
    const plugin = join(root, '.tutti', 'plugins', 'tutti-mcp')
    expect(JSON.parse(readFileSync(join(plugin, 'plugin.json'), 'utf8'))).toEqual({ name: 'tutti-mcp' })
    expect(JSON.parse(readFileSync(join(root, '.agents', 'plugins.json'), 'utf8'))).toEqual({ entries: [{ path: '.tutti/plugins' }] })
    const servers = JSON.parse(readFileSync(join(plugin, 'mcp_config.json'), 'utf8')).mcpServers
    expect(servers.loc).toEqual({ command: 'node', args: ['${PLUGIN_ROOT}/../../mcp/launch.mjs', 'loc'] })
    expect(servers.api).toEqual({ url: 'https://x/mcp' })
    const listed = listServers(root).filter((x) => x.agent === 'agy' && x.scope === 'project')
    expect(listed.map((x) => x.name).sort()).toEqual(['ajeno', 'api', 'loc'])
    expect(listed.find((x) => x.name === 'loc')!.target).toBe('npx -y srv')                // se muestra lo de .mcp.json
    expect((await removeServer(listed.find((x) => x.name === 'ajeno')!, root)).ok).toBe(true)
    expect(JSON.parse(readFileSync(join(root, '.agents', 'plugins', 'otro', 'mcp_config.json'), 'utf8')).mcpServers).toEqual({})
  })
  it('Codex en el proyecto: refleja .mcp.json en .codex/config.toml y se lee con la configuración de allí', async () => {
    const root = dir()
    writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: { loc: { type: 'stdio', command: 'npx', args: ['-y', 'srv'] } } }))
    expect((await addServer('codex', { name: 'loc', kind: 'local', command: 'npx', args: ['-y', 'srv'] }, 'project', root)).ok).toBe(true)
    const listed = listServers(root).filter((x) => x.agent === 'codex' && x.scope === 'project')
    expect(listed.map((x) => [x.name, x.target])).toEqual([['loc', 'npx -y srv']])
    expect((await removeServer(listed[0], root)).ok).toBe(true)
    expect(listServers(root).filter((x) => x.agent === 'codex' && x.scope === 'project')).toEqual([])
  })
})

suite('Cursor Agent y Qwen Code', () => {
  const spec = { name: 'loc', kind: 'local' as const, command: 'npx', args: ['-y', 'srv'], env: { A: '1' } }
  it('Qwen Code usa los mismos argumentos que Gemini CLI', () => {
    expect(buildAddArgv('qwen', spec, 'project')).toEqual(['qwen', 'mcp', 'add', '-s', 'project', '-e', 'A=1', 'loc', 'npx', '-y', 'srv'])
  })
  it('Claude: el alcance compartido va a .mcp.json (-s project)', () => {
    expect(buildAddArgv('claude', spec, 'shared')).toContain('project')
    expect(buildAddArgv('claude', spec, 'project')).toContain('local')
  })
  it('Cursor: escribe y quita en .cursor/mcp.json conservando lo demás', async () => {
    const root = dir()
    mkdirSync(join(root, '.cursor'))
    writeFileSync(join(root, '.cursor', 'mcp.json'), JSON.stringify({ otra: 1, mcpServers: { viejo: { command: 'v' } } }))
    expect((await addServer('cursor', spec, 'project', root)).ok).toBe(true)
    expect((await addServer('cursor', { name: 'api', kind: 'remote', url: 'https://x/mcp', headers: { A: 'b' } }, 'project', root)).ok).toBe(true)
    const file = JSON.parse(readFileSync(join(root, '.cursor', 'mcp.json'), 'utf8'))
    expect(file.otra).toBe(1)
    expect(file.mcpServers.loc).toEqual({ command: 'npx', args: ['-y', 'srv'], env: { A: '1' } })
    expect(file.mcpServers.api).toEqual({ url: 'https://x/mcp', headers: { A: 'b' } })
    const listed = listServers(root).filter((x) => x.agent === 'cursor' && x.scope === 'project').map((x) => x.name).sort()
    expect(listed).toEqual(['api', 'loc', 'viejo'])
  })
})
