import { describe, expect, it } from 'vitest'
import { workingSubagents, type ChatMessage } from '@/store/chat'

const agent = (id: number, sub: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id, role: 'tool', text: 'Agent', toolId: `t${id}`, sub, ...extra })

describe('roles trabajando como subagentes del chat', () => {
  it('cuenta los que no han terminado', () => {
    const msgs = [agent(1, 'revisor'), agent(2, 'lider', { result: 'ok' }), agent(3, 'dba', { task: { status: 'running', tools: 1, tokens: 0, ms: 0 } }), agent(4, 'fmt', { task: { status: 'completed', tools: 2, tokens: 0, ms: 0 } })]
    expect([...workingSubagents(msgs, true)].sort()).toEqual(['dba', 'revisor'])
  })
  it('con el chat parado no hay ninguno trabajando', () => {
    expect(workingSubagents([agent(1, 'revisor')], false).size).toBe(0)
  })
})
