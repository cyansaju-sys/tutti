import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { planText } from '@/harnes/claude/chat'
import { historyOf } from '@/harnes/claude/history'

const user = (content: unknown, parent: string | null = null) => ({ type: 'user', message: { content }, parent_tool_use_id: parent })
const assistant = (content: unknown, parent: string | null = null) => ({ type: 'assistant', message: { content }, parent_tool_use_id: parent })

describe('el historial de una conversación guardada', () => {
  it('trae el razonamiento, las herramientas con su resultado y lo que hizo cada subagente', () => {
    const h = historyOf([
      user('revisa el módulo'),
      assistant([{ type: 'thinking', thinking: 'Primero miro el código' }, { type: 'text', text: 'Voy a delegarlo' }, { type: 'tool_use', id: 'ag1', name: 'Agent', input: { subagent_type: 'revisor', description: 'Revisar', prompt: 'mira auth' } }]),
      user('mira auth', 'ag1'),                                                                  // el encargo al subagente: ya está en su herramienta
      assistant([{ type: 'tool_use', id: 'rd1', name: 'Read', input: { file_path: '/p/a.ts' } }], 'ag1'),
      user([{ type: 'tool_result', tool_use_id: 'rd1', content: [{ type: 'text', text: 'contenido' }] }], 'ag1'),
      assistant([{ type: 'text', text: 'Todo bien' }], 'ag1'),
      user([{ type: 'tool_result', tool_use_id: 'ag1', content: 'Sin fallos', is_error: false }]),
      assistant([{ type: 'text', text: 'Listo' }])
    ])
    expect(h.map((m) => [m.role, m.parent ?? '', m.text])).toEqual([
      ['user', '', 'revisa el módulo'], ['thinking', '', 'Primero miro el código'], ['assistant', '', 'Voy a delegarlo'], ['tool', '', 'Agent'],
      ['tool', 'ag1', 'Read'], ['assistant', 'ag1', 'Todo bien'], ['assistant', '', 'Listo']
    ])
    expect(h[3]).toMatchObject({ toolId: 'ag1', sub: 'revisor', result: 'Sin fallos', resultError: false })
    expect(h[4]).toMatchObject({ toolId: 'rd1', file: '/p/a.ts', result: 'contenido' })
  })
  it('ignora lo que no son mensajes y los razonamientos vacíos', () => {
    expect(historyOf([{ type: 'system' }, assistant([{ type: 'thinking', thinking: '  ' }])])).toEqual([])
  })
})

describe('el plan de Claude', () => {
  let home = ''
  beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'tutti-plan-')) })
  afterEach(() => rmSync(home, { recursive: true, force: true }))
  it('sale del propio input', () => { expect(planText({ plan: '  # Plan\n- uno ' }, home)).toBe('# Plan\n- uno') })
  it('o del archivo indicado', () => {
    const file = join(home, 'p.md'); writeFileSync(file, '# Desde archivo\n')
    expect(planText({ planFilePath: file }, home)).toBe('# Desde archivo')
  })
  it('o del último plan guardado en ~/.claude/plans', () => {
    mkdirSync(join(home, '.claude', 'plans'), { recursive: true })
    writeFileSync(join(home, '.claude', 'plans', 'x.md'), '# Reciente')
    expect(planText({}, home)).toBe('# Reciente')
  })
  it('vacío si no hay nada', () => { expect(planText({}, home)).toBe('') })
})
