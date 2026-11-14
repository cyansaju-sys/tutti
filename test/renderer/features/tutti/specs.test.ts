import { describe, expect, it } from 'vitest'
import { applyPrompt, planPrompt, specName } from '@/renderer/src/features/tutti/lib/specs'

describe('specs', () => {
  it('el nombre de la carpeta sale de lo pedido, o del indicado', () => {
    expect(specName('Añadir carrito de compra con pago en un paso y más cosas')).toBe('anadir-carrito-de-compra-con-pago')
    expect(specName('lo que sea', 'Mi spec')).toBe('mi-spec')
    expect(specName('!!')).toBe('')
  })

  it('los mensajes al agente apuntan a la carpeta de la spec', () => {
    expect(planPrompt('es', '.tutti/specs', 'add-cart', 'Un carrito')).toContain('.tutti/specs/add-cart')
    expect(planPrompt('en', '.tutti/specs', 'add-cart', 'A cart')).toContain('requirements.md')
    expect(applyPrompt('es', '.tutti/specs', 'add-cart')).toContain('«- [x]»')
  })
})
