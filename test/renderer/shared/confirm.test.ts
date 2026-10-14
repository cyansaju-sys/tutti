import { describe, expect, it } from 'vitest'
import { confirmAsk, useConfirm } from '../../../src/renderer/src/shared/lib/confirm'

describe('preguntas de sí o no dentro de la app', () => {
  it('queda pendiente hasta que se contesta, y se cierra al hacerlo', async () => {
    const answer = confirmAsk('¿Cerrarlo sin guardar?', 'Cerrar sin guardar')
    expect(useConfirm.getState().ask).toMatchObject({ message: '¿Cerrarlo sin guardar?', ok: 'Cerrar sin guardar' })
    useConfirm.getState().ask!.resolve(true)
    expect(await answer).toBe(true)
    expect(useConfirm.getState().ask).toBeNull()
  })
  it('cancelar devuelve false', async () => {
    const answer = confirmAsk('¿Continuar?')
    expect(useConfirm.getState().ask?.ok).toBeNull()               // sin texto propio: el diálogo pone «Aceptar»
    useConfirm.getState().ask!.resolve(false)
    expect(await answer).toBe(false)
  })
  it('una pregunta nueva cancela la anterior sin contestar', async () => {
    const first = confirmAsk('primera')
    const second = confirmAsk('segunda')
    expect(await first).toBe(false)
    expect(useConfirm.getState().ask?.message).toBe('segunda')
    useConfirm.getState().ask!.resolve(true)
    expect(await second).toBe(true)
  })
  it('contestar una pregunta ya reemplazada no cierra la vigente', async () => {
    const first = confirmAsk('primera')
    const stale = useConfirm.getState().ask!
    const second = confirmAsk('segunda')
    stale.resolve(true)
    expect(await first).toBe(false)                                 // ya estaba contestada: la primera respuesta manda
    expect(useConfirm.getState().ask?.message).toBe('segunda')
    useConfirm.getState().ask!.resolve(false)
    await second
  })
})
