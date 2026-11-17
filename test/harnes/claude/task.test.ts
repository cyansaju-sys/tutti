import { describe, expect, it } from 'vitest'
import { taskEvent } from '@/harnes/claude/chat'

describe('progreso de subagentes', () => {
  it('el progreso trae herramientas, tokens, tiempo y la última herramienta', () => {
    expect(taskEvent({ type: 'system', subtype: 'task_progress', tool_use_id: 'a1', usage: { total_tokens: 1200, tool_uses: 3, duration_ms: 4000 }, last_tool_name: 'Read' }))
      .toEqual({ kind: 'task', id: 'a1', status: 'running', tools: 3, tokens: 1200, ms: 4000, last: 'Read' })
  })
  it('al empezar y al terminar marca el estado', () => {
    expect(taskEvent({ type: 'system', subtype: 'task_started', tool_use_id: 'a1' })).toEqual({ kind: 'task', id: 'a1', status: 'running' })
    expect(taskEvent({ type: 'system', subtype: 'task_notification', tool_use_id: 'a1', status: 'failed' })).toMatchObject({ kind: 'task', id: 'a1', status: 'failed' })
  })
  it('ignora lo que no es de una herramienta', () => {
    expect(taskEvent({ type: 'system', subtype: 'task_started' })).toBeNull()
    expect(taskEvent({ type: 'system', subtype: 'init', tool_use_id: 'a1' })).toBeNull()
  })
})
