import { afterEach, describe, expect, it } from 'vitest'
import { migrateLegacyStorageKeys } from './legacyStorage.js'

afterEach(() => {
  localStorage.clear()
})

describe('migrateLegacyStorageKeys', () => {
  it('moves every legacy key to the Tiendario prefix', () => {
    localStorage.setItem('vitrinapp-cart-almacen-demo', '{"items":[1]}')
    localStorage.setItem('vitrinapp-order-sound-muted', '1')
    localStorage.setItem('other-key', 'kept')

    migrateLegacyStorageKeys(localStorage)

    expect(localStorage.getItem('tiendario-cart-almacen-demo')).toBe('{"items":[1]}')
    expect(localStorage.getItem('tiendario-order-sound-muted')).toBe('1')
    expect(localStorage.getItem('vitrinapp-cart-almacen-demo')).toBeNull()
    expect(localStorage.getItem('other-key')).toBe('kept')
  })

  it('keeps newer data when both keys exist', () => {
    localStorage.setItem('vitrinapp-orders-almacen-demo', '["old"]')
    localStorage.setItem('tiendario-orders-almacen-demo', '["new"]')

    migrateLegacyStorageKeys(localStorage)

    expect(localStorage.getItem('tiendario-orders-almacen-demo')).toBe('["new"]')
    expect(localStorage.getItem('vitrinapp-orders-almacen-demo')).toBeNull()
  })

  it('ignores unavailable storage', () => {
    expect(() => migrateLegacyStorageKeys(undefined)).not.toThrow()
    expect(() => migrateLegacyStorageKeys({ get length() { throw new Error('blocked') } })).not.toThrow()
  })
})
