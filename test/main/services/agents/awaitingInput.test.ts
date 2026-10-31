import { describe, expect, it } from 'vitest'
import { awaitingInput } from '../../../../src/main/services/agents/launch'

describe('awaitingInput', () => {
  it('reconoce las peticiones de permiso de los agentes', () => {
    expect(awaitingInput('Edit file src/a.ts\n Do you want to make this edit to a.ts?\n ❯ 1. Yes\n   2. No')).toBe(true)
    expect(awaitingInput('Allow execution of: npm test\n  ● Allow once\n  ○ Allow always')).toBe(true)
    expect(awaitingInput('Permission required: bash rm -rf dist')).toBe(true)
    expect(awaitingInput('Overwrite file? (y/n)')).toBe(true)
  })
  it('no confunde una pantalla normal con una petición', () => {
    expect(awaitingInput('● Updated src/a.ts\n  Tests pass.\n> ')).toBe(false)
  })
  it('solo mira el final: una petición ya respondida más arriba no cuenta', () => {
    const old = ['Do you want to proceed?', ...Array.from({ length: 30 }, (_, i) => `línea ${i}`)].join('\n')
    expect(awaitingInput(old)).toBe(false)
  })
})

describe('typedSomething', () => {
  it('lo que la terminal manda sola no cuenta como teclear', async () => {
    const { typedSomething } = await import('../../../../src/main/services/agents/pty')
    expect(typedSomething('\x1b[I')).toBe(false)                       // entra el foco
    expect(typedSomething('\x1b[O')).toBe(false)                       // sale el foco
    expect(typedSomething('\x1b[<35;12;7M')).toBe(false)               // ratón SGR
    expect(typedSomething('\x1b[M #!')).toBe(false)                    // ratón clásico (bytes en crudo)
    expect(typedSomething('\x1b[24;80R')).toBe(false)                  // posición del cursor
    expect(typedSomething('\x1b[?62;22c')).toBe(false)                 // atributos del terminal
    expect(typedSomething('\x1b]11;rgb:0000/0000/0000\x1b\\')).toBe(false)          // color de fondo
  })
  it('texto, Enter y borrar sí cuentan', async () => {
    const { typedSomething } = await import('../../../../src/main/services/agents/pty')
    expect(typedSomething('en español')).toBe(true)
    expect(typedSomething('\r')).toBe(true)
    expect(typedSomething('\x7f')).toBe(true)
    expect(typedSomething('\x1b[<35;12;7Mhola')).toBe(true)
  })
})

describe('awaitingInput: otras formas de pedir permiso', () => {
  it('reconoce confianza, aplicar cambios y confirmaciones por teclado', () => {
    expect(awaitingInput('Do you trust the files in this folder?')).toBe(true)
    expect(awaitingInput('Apply these changes?\n  Enter to confirm · Esc to cancel')).toBe(true)
    expect(awaitingInput('  ❯ Yes, allow all edits during this session')).toBe(true)
    expect(awaitingInput('¿Aceptar los cambios?')).toBe(true)
    expect(awaitingInput('Este comando requiere tu aprobación')).toBe(true)
    expect(awaitingInput('This command requires your approval')).toBe(true)
  })
  it('un texto normal sobre confianza o cambios no cuenta', () => {
    expect(awaitingInput('I applied the changes and trust the result.')).toBe(false)
    expect(awaitingInput('Tests pass. Ready to apply changes later.')).toBe(false)
  })
})
