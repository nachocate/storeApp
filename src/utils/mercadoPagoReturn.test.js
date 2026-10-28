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

  it('expires stale return markers', () => {
    const storage = createStorage()
    const now = () => 1_000

    expect(rememberMercadoPagoReturnPublicOrderId('store-a', 'public-id-42', storage, now)).toBe(true)
    expect(takeMercadoPagoReturnPublicOrderId('store-a', storage, () => 1_000 + 24 * 60 * 60 * 1000))
      .toBe('')
  })

  it('keeps the return marker in local storage when session storage is cleared', () => {
    const key = 'vitrinapp-mercadopago-return-store-a'
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)

    expect(rememberMercadoPagoReturnPublicOrderId('store-a', 'public-id-42')).toBe(true)
    sessionStorage.removeItem(key)

    expect(takeMercadoPagoReturnPublicOrderId('store-a')).toBe('public-id-42')
    localStorage.removeItem(key)
  })
})
