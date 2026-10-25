import { describe, expect, it } from 'vitest'
import {
  rememberMercadoPagoReturnPublicOrderId,
  takeMercadoPagoReturnPublicOrderId
} from './mercadoPagoReturn.js'

const createStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  }
}

describe('Mercado Pago return tracking', () => {
  it('remembers and consumes an order id scoped to its store', () => {
    const storage = createStorage()

    expect(rememberMercadoPagoReturnPublicOrderId('store-a', 'public-id-42', storage)).toBe(true)
    expect(takeMercadoPagoReturnPublicOrderId('store-b', storage)).toBe('')
    expect(takeMercadoPagoReturnPublicOrderId('store-a', storage)).toBe('public-id-42')
    expect(takeMercadoPagoReturnPublicOrderId('store-a', storage)).toBe('')
  })

  it('handles unavailable session storage without interrupting payment flow', () => {
    const unavailableStorage = {
      setItem() { throw new Error('storage unavailable') },
      getItem() { throw new Error('storage unavailable') },
      removeItem() { throw new Error('storage unavailable') }
    }

    expect(rememberMercadoPagoReturnPublicOrderId('store-a', 'public-id-42', unavailableStorage)).toBe(false)
    expect(takeMercadoPagoReturnPublicOrderId('store-a', unavailableStorage)).toBe('')
  })
})
