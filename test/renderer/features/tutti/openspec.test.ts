import { describe, expect, it } from 'vitest'
import { applyPrompt, changeName, proposePrompt } from '../../../../src/renderer/src/features/tutti/lib/openspec'

describe('cambios de OpenSpec', () => {
  it('el nombre de la carpeta sale de lo pedido, o del indicado', () => {
    expect(changeName('Añadir carrito de compra con pago en un paso y más cosas')).toBe('anadir-carrito-de-compra-con-pago')
    expect(changeName('lo que sea', 'Mi cambio')).toBe('mi-cambio')
    expect(changeName('!!')).toBe('')
  })

  it('los mensajes al agente apuntan a la carpeta del cambio', () => {
    expect(proposePrompt('es', 'add-cart', 'Un carrito')).toContain('openspec/changes/add-cart')
    expect(proposePrompt('en', 'add-cart', 'A cart')).toContain('openspec validate add-cart --strict')
    expect(applyPrompt('es', 'add-cart')).toContain('«- [x]»')
  })
})
