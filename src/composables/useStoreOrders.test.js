import { createApp } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStoreOrders } from './useStoreOrders.js'

const createMountedOrders = (options = {}) => {
  let storeOrders
  const app = createApp({
    setup() {
      storeOrders = useStoreOrders(options)
      return () => null
    }
  })
  app.mount(document.createElement('div'))
  return { app, storeOrders }
}

describe('useStoreOrders', () => {
  let mountedOrders

  beforeEach(() => localStorage.clear())
  afterEach(() => {
    mountedOrders?.app.unmount()
    mountedOrders = null
    localStorage.clear()
  })

  it('stores tracking credentials under a key scoped to the store', () => {
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })
    mountedOrders.storeOrders.addOrder({
      orderId: 42,
      orderStatus: 'PENDING_PAYMENT',
      paymentProvider: 'TRANSFER',
      fulfillmentType: 'PICKUP',
      totalAmount: '11000.00',
      currency: 'ARS',
      orderTrackingToken: 'private-token'
    })

    expect(localStorage.getItem('vitrinapp-orders-almacen-demo')).toContain('private-token')
    expect(localStorage.getItem('vitrinapp-orders-another-store')).toBeNull()
    expect(mountedOrders.storeOrders.orders.value[0].expiresAt).toBe(1000 + 30 * 24 * 60 * 60 * 1000)
  })

  it('requires an order id to associate the tracking token with the order', () => {
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })

    expect(() => mountedOrders.storeOrders.addOrder({ orderTrackingToken: 'private-token' }))
      .toThrow('identificador del pedido')
    expect(mountedOrders.storeOrders.orders.value).toEqual([])
  })

  it('syncs the canonical status with the tracking header and drops completed orders', async () => {
    const apiRequest = vi.fn().mockResolvedValue({ orderId: 42, status: 'COMPLETED' })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('completed')

    expect(apiRequest).toHaveBeenCalledWith('/orders/current', {
      orderTrackingToken: 'private-token'
    })
    expect(mountedOrders.storeOrders.orders.value).toEqual([])
  })

  it('drops the order when the API rejects the token or returns another order', async () => {
    const apiRequest = vi.fn()
      .mockResolvedValueOnce({ orderId: 99, status: 'PREPARING' })
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { status: 401 }))
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('unavailable')
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })
    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('unavailable')
    expect(mountedOrders.storeOrders.orders.value).toEqual([])
  })

  it('stores the status timeline returned by the tracking endpoint', async () => {
    const statusTimeline = [
      { code: 'PENDING_AVAILABILITY', label: 'Pendiente de confirmación', state: 'COMPLETED' },
      { code: 'CONFIRMED', label: 'Pedido confirmado', state: 'CURRENT' }
    ]
    const apiRequest = vi.fn().mockResolvedValue({ orderId: 42, status: 'CONFIRMED', statusTimeline })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('ok')

    expect(mountedOrders.storeOrders.orders.value[0].statusTimeline).toEqual(statusTimeline)
  })

  it('keeps the order and exposes an error on transient failures', async () => {
    const apiRequest = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }))
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('error')
    expect(mountedOrders.storeOrders.orderErrors[42]).toBe('boom')
    expect(mountedOrders.storeOrders.orders.value).toHaveLength(1)
  })

  it('purges expired records and records with completed status during restore', () => {
    localStorage.setItem('vitrinapp-orders-almacen-demo', JSON.stringify([
      { orderId: 1, orderTrackingToken: 'expired', expiresAt: 999 },
      { orderId: 2, orderTrackingToken: 'done', expiresAt: 2000, orderStatus: 'COMPLETED' },
      { orderId: 3, orderTrackingToken: 'active', expiresAt: 2000, orderStatus: 'PREPARING' }
    ]))
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })

    expect(mountedOrders.storeOrders.orders.value.map((order) => order.orderId)).toEqual([3])
  })

  it('rejects invalid proof files before making an API request', async () => {
    const apiRequest = vi.fn()
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.submitTransferProof(42, {
      type: 'application/pdf',
      size: 100
    })).rejects.toThrow('JPEG, PNG o WebP')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('sends a valid proof as multipart with the order tracking token', async () => {
    const apiRequest = vi.fn().mockResolvedValue({ id: 5, status: 'PENDING' })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })
    const file = new File(['image'], 'proof.png', { type: 'image/png' })

    await mountedOrders.storeOrders.submitTransferProof(42, file)

    const [path, options] = apiRequest.mock.calls[0]
    expect(path).toBe('/orders/current/transfer-proofs')
    expect(options.orderTrackingToken).toBe('private-token')
    expect(options.formData.get('file')).toBe(file)
  })
})