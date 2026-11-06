import { describe, expect, it } from 'vitest'
import {
  consumeOrderTrackingTokenFromHash,
  forgetOrderTrackingToken,
  readOrderTrackingToken,
  rememberOrderTrackingToken
} from './orderTrackingCredentials.js'

const createStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  }
}

describe('order tracking credentials', () => {
  it('stores tokens by store and public order id for 30 days', () => {
    const storage = createStorage()
    const now = () => 1000

    expect(rememberOrderTrackingToken('shop', 'public-id', 'secret-token', storage, now)).toBe(true)
    expect(readOrderTrackingToken('shop', 'public-id', storage, now)).toBe('secret-token')
    expect(readOrderTrackingToken('other-shop', 'public-id', storage, now)).toBe('')
    expect(readOrderTrackingToken('shop', 'public-id', storage, () => 30 * 24 * 60 * 60 * 1000 + 1000))
      .toBe('')
  })

  it('consumes the tracking token from the URL fragment and immediately removes the fragment', () => {
    const storage = createStorage()
    const location = {
      hash: '#trackingToken=secret-token',
      pathname: '/orders/public-id',
      search: '?source=email'
    }
    const history = { state: null, replaceState: (...args) => { history.call = args } }

    expect(consumeOrderTrackingTokenFromHash({
      storeSlug: 'shop',
      publicOrderId: 'public-id',
      location,
      history,
      storage
    })).toBe('secret-token')
    expect(history.call).toEqual([null, '', '/orders/public-id?source=email'])
    expect(readOrderTrackingToken('shop', 'public-id', storage)).toBe('secret-token')
  })

  it('removes stored credentials when access is rejected', () => {
    const storage = createStorage()
    rememberOrderTrackingToken('shop', 'public-id', 'secret-token', storage)

    forgetOrderTrackingToken('shop', 'public-id', storage)

    expect(readOrderTrackingToken('shop', 'public-id', storage)).toBe('')
  })
})
