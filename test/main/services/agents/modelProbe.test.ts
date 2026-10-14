import { describe, expect, it } from 'vitest'
import { BLOCKING, canProbe, claudeId, modelIds, parseModelList, plainId } from '../../../../src/main/services/agents/modelProbe'
import { availableModels } from '../../../../src/main/services/agents/models'

// pantallas reales de Claude Code 2.1 y Codex 0.162 tras escribir /model
const CLAUDE = `
 ▐▛███▛█   Claude Code v2.1.299
▝▜██████▀  Opus 5.5 · Claude Pro
   Select model
   Switch between Claude models. Your pick becomes the default for new sessions. For other/previous model names, specify with --model.

   ❯ 1.  Default (recommended) ✔  Opus 5.5 · Best for everyday, complex tasks
     2.  Opus 5.5                 For complex work and everyday tasks
     3.  Sonnet 5.5               Most efficient for simpler tasks
     4.  Fable 5.1                For your toughest challenges
     5.  Haiku 5.5                Fastest for quick answers
   ↓ 6.  Sonnet 5.5 (1M context)  Long sessions
      … +3 models

   ◐ Medium effort (default) ←/→ to adjust
   Enter to set as default · s to use this session only · Esc to cancel`

const CODEX = `
  >_ OpenAI Codex (v0.162.1)
  1. Antes de esto: una lista numerada que no es del selector
  Select Model and Effort

  1. GPT-6-Luna              Fast and affordable model for easier tasks.
  2. GPT-5.6-Terra           Older balanced model for straightforward work.
› 3. GPT-5.6-Luna (current)  Older fast and efficient model.

  enter select · esc back`

describe('selector /model', () => {
  it('lee las opciones de Claude Code y las pasa a ids de --model', () => {
    const items = parseModelList(CLAUDE)
    expect(items.map((i) => i.label)).toEqual(['Default', 'Opus 5.5', 'Sonnet 5.5', 'Fable 5.1', 'Haiku 5.5', 'Sonnet 5.5 (1M context)'])
    expect(modelIds('claude', items)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-haiku-5-5', 'claude-sonnet-5-5[1m]'])
  })
  it('lee las de Codex, solo debajo del título del selector', () => {
    const items = parseModelList(CODEX)
    expect(items).toEqual([{ n: 1, label: 'GPT-6-Luna' }, { n: 2, label: 'GPT-5.6-Terra' }, { n: 3, label: 'GPT-5.6-Luna' }])
    expect(modelIds('codex', items)).toEqual(['gpt-6-luna', 'gpt-5.6-terra', 'gpt-5.6-luna'])
  })
  it('sin selector en pantalla no hay nada', () => { expect(parseModelList('› Ask Codex to do anything\n  1. algo')).toEqual([]) })
  it('junta lo visto al bajar por la lista, por número y sin repetir', () => {
    expect(modelIds('codex', [{ n: 2, label: 'b' }, { n: 1, label: 'a' }, { n: 2, label: 'b' }, { n: 3, label: 'c' }])).toEqual(['a', 'b', 'c'])
  })
  it('ids: Default y lo que no es un modelo se descartan', () => {
    expect(claudeId('Default')).toBeNull()
    expect(claudeId('Opus 4.8')).toBe('claude-opus-4-8')
    expect(claudeId('Sonnet 5')).toBe('claude-sonnet-5')
    expect(plainId('gemini-2.5-pro')).toBe('gemini-2.5-pro')
    expect(plainId('Default model')).toBeNull()
    expect(plainId('¿raro?')).toBeNull()
  })
  it('se cierra sin contestar si pide confiar en la carpeta o iniciar sesión', () => {
    expect(BLOCKING.test(' Quick safety check: Is this a project you created or one you trust?\n ❯ No, exit\n   Yes, I trust this folder')).toBe(true)
    expect(BLOCKING.test('Do you trust the files in this folder?')).toBe(true)
    expect(BLOCKING.test('Select login method:')).toBe(true)
    expect(BLOCKING.test('› Ask Codex to do anything')).toBe(false)
  })
  it('solo los agentes con /model', () => {
    expect(['claude', 'codex', 'gemini', 'qwen', 'copilot'].every(canProbe)).toBe(true)
    expect(canProbe('opencode')).toBe(false)
  })
  it('sin carpeta del proyecto no se abre el agente: lista fija', async () => {
    expect((await availableModels('claude')).map((m) => m.id)).toContain('opus')
  })
})
