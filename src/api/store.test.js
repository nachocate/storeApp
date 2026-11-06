import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestStoreApi } from './store.js'

describe('requestStoreApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('encodes query parameters and sends the tracking token only in a header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ days: [] })
    }))

    await requestStoreApi('/carts/current/fulfillment-windows', {
      cartToken: 'cart-secret',
      query: { fulfillmentType: 'DELIVERY', from: '2026-10-14', days: 14 }
    })

    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('fulfillmentType=DELIVERY')
    expect(url).toContain('from=2026-10-14')
    expect(options.headers['X-Cart-Token']).toBe('cart-secret')
    expect(url).not.toContain('cart-secret')
  })

  it('sends FormData without setting a JSON content type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 5 })
    }))
    const formData = new FormData()
    formData.append('file', new Blob(['image'], { type: 'image/png' }), 'proof.png')

    await requestStoreApi('/orders/current/transfer-proofs', {
      method: 'POST',
      orderTrackingToken: 'private-order-token',
      formData
    })

    const [url, options] = fetch.mock.calls[0]
    expect(options.headers['X-Order-Tracking-Token']).toBe('private-order-token')
    expect(options.headers).not.toHaveProperty('Content-Type')
    expect(options.body).toBe(formData)
    expect(url).not.toContain('private-order-token')
  })

  it('sends cancellation reason and tracking token in the expected request fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204
    }))

    await expect(requestStoreApi('/orders/current/cancellation', {
      method: 'POST',
      orderTrackingToken: 'private-order-token',
      body: { reason: 'Ya no lo necesito.' }
    })).resolves.toBeNull()

    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/orders/current/cancellation')
    expect(options.headers['X-Order-Tracking-Token']).toBe('private-order-token')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe(JSON.stringify({ reason: 'Ya no lo necesito.' }))
    expect(url).not.toContain('private-order-token')
  })

  it('sends payment method changes as PUT with the tracking token in a header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ orderId: 42, paymentProvider: 'TRANSFER' })
    }))

    await requestStoreApi('/orders/current/payment-method', {
      method: 'PUT',
      orderTrackingToken: 'private-order-token',
      body: { paymentProvider: 'TRANSFER' }
    })

    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/orders/current/payment-method')
    expect(options.method).toBe('PUT')
    expect(options.headers['X-Order-Tracking-Token']).toBe('private-order-token')
    expect(options.body).toBe(JSON.stringify({ paymentProvider: 'TRANSFER' }))
    expect(url).not.toContain('private-order-token')
  })

  it('extracts API error codes from nested error payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'payment_method_change_not_allowed',
          message: 'Order status changed'
        }
      })
    }))

    await expect(requestStoreApi('/orders/current/payment-method', {
      method: 'PUT',
      orderTrackingToken: 'private-order-token',
      body: { paymentProvider: 'TRANSFER' }
    })).rejects.toMatchObject({
      status: 409,
      code: 'payment_method_change_not_allowed',
      message: 'Order status changed'
    })
  })
})