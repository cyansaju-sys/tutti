import { describe, expect, it } from 'vitest'
import { agentOptions, defaultOption } from '../../../../src/renderer/src/features/tutti/lib/agentTarget'

const pane = (id: string, command: string, name: string) => ({ id, kind: 'agent' as const, title: `${name} · p`, name, command, args: [], cwd: '/p' })
const installed = [{ name: 'Claude Code', command: 'claude', path: '/bin/claude' }, { name: 'Codex', command: 'codex', path: '/bin/codex' }, { name: 'OpenCode', command: 'opencode', path: '/bin/opencode' }]

describe('a qué agente se le pide algo', () => {
  it('sin agentes abiertos se ofrecen los instalados, y el primero es el de por defecto', () => {
    const options = agentOptions([], installed, null)
    expect(options.map((o) => [o.name, !!o.paneId])).toEqual([['Claude Code', false], ['Codex', false], ['OpenCode', false]])
    expect(defaultOption(options)?.command).toBe('claude')
  })

  it('los abiertos van primero (el activo, el primero) y los instalados no se repiten', () => {
    const panes = [pane('a1', 'claude', 'Claude Code'), pane('a2', 'codex', 'Codex')]
    const options = agentOptions(panes, installed, 'a2')
    expect(options.map((o) => [o.name, o.paneId])).toEqual([['Codex', 'a2'], ['Claude Code', 'a1'], ['OpenCode', undefined]])
    expect(defaultOption(options)?.paneId).toBe('a2')
  })

  it('sin agentes de ningún tipo no hay opciones', () => {
    expect(agentOptions([], [], null)).toEqual([])
    expect(defaultOption([])).toBeNull()
  })

  it('las terminales no cuentan como agentes', () => {
    const shell = { ...pane('s1', 'zsh', 'zsh'), kind: 'shell' as const }
    expect(agentOptions([shell], [], null)).toEqual([])
  })
})
