import { createApp } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rememberOrderTrackingToken } from '../utils/orderTrackingCredentials.js'
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

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    mountedOrders?.app.unmount()
    mountedOrders = null
    localStorage.clear()
    sessionStorage.clear()
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

    expect(localStorage.getItem('tiendario-orders-almacen-demo')).toContain('private-token')
    expect(localStorage.getItem('tiendario-orders-another-store')).toBeNull()
    expect(mountedOrders.storeOrders.orders.value[0].expiresAt).toBe(1000 + 30 * 24 * 60 * 60 * 1000)
  })

  it('persists a normalized order product snapshot', () => {
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })
    mountedOrders.storeOrders.addOrder({
      orderId: 42,
      orderTrackingToken: 'private-token',
      items: [{
        name: 'Café',
        variantLabel: 'Molido',
        quantity: 2,
        unitSymbol: 'u',
        decimalScale: 0
      }]
    })

    expect(mountedOrders.storeOrders.orders.value[0].items).toEqual([{
      name: 'Café',
      variantLabel: 'Molido',
      quantity: 2,
      unitSymbol: 'u',
      decimalScale: 0
    }])
    expect(JSON.parse(localStorage.getItem('tiendario-orders-almacen-demo'))[0].items[0].name)
      .toBe('Café')
  })

  it('stores checkout tracking credentials by public order ID in the current session', () => {
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })
    mountedOrders.storeOrders.addOrder({
      orderId: 42,
      publicOrderId: 'public-id-42',
      orderTrackingToken: 'private-token'
    })

    expect(sessionStorage.length).toBeGreaterThan(0)
    expect(sessionStorage.getItem('tiendario-order-tracking-almacen-demo-public-id-42'))
      .toContain('private-token')
  })

  it('persists the Mercado Pago checkout link for payment retries', () => {
    const checkoutUrl = 'https://www.mercadopago.com/checkout'
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })
    mountedOrders.storeOrders.addOrder({
      orderId: 42,
      publicOrderId: 'public-id-42',
      orderTrackingToken: 'private-token',
      orderStatus: 'PENDING_PAYMENT',
      paymentProvider: 'MERCADO_PAGO',
      mercadoPagoCheckoutUrl: checkoutUrl
    })

    expect(mountedOrders.storeOrders.orders.value[0].mercadoPagoCheckoutUrl).toBe(checkoutUrl)
    expect(JSON.parse(localStorage.getItem('tiendario-orders-almacen-demo'))[0].mercadoPagoCheckoutUrl)
      .toBe(checkoutUrl)
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

  it('preserves the saved Mercado Pago link when the tracking response omits it', async () => {
    const checkoutUrl = 'https://www.mercadopago.com/checkout'
    const apiRequest = vi.fn().mockResolvedValue({
      orderId: 42,
      status: 'PENDING_PAYMENT',
      paymentProvider: 'MERCADO_PAGO'
    })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({
      orderId: 42,
      orderTrackingToken: 'private-token',
      orderStatus: 'PENDING_PAYMENT',
      paymentProvider: 'MERCADO_PAGO',
      mercadoPagoCheckoutUrl: checkoutUrl
    })

    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('ok')

    expect(mountedOrders.storeOrders.orders.value[0].mercadoPagoCheckoutUrl).toBe(checkoutUrl)
  })

  it('preserves the saved Mercado Pago link when loading by public order ID', async () => {
    const checkoutUrl = 'https://www.mercadopago.com/checkout'
    const apiRequest = vi.fn().mockResolvedValue({
      orderId: 42,
      publicOrderId: 'public-id-42',
      status: 'PENDING_PAYMENT',
      paymentProvider: 'MERCADO_PAGO'
    })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({
      orderId: 42,
      publicOrderId: 'public-id-42',
      orderTrackingToken: 'private-token',
      orderStatus: 'PENDING_PAYMENT',
      paymentProvider: 'MERCADO_PAGO',
      mercadoPagoCheckoutUrl: checkoutUrl
    })

    await expect(mountedOrders.storeOrders.loadOrderByPublicId('public-id-42')).resolves.toBe('ok')

    expect(mountedOrders.storeOrders.orders.value[0].mercadoPagoCheckoutUrl).toBe(checkoutUrl)
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

  it('loads and refreshes an emailed order using its token and validates the public ID', async () => {
    const apiRequest = vi.fn()
      .mockResolvedValueOnce({
        data: {
          orderId: 42,
          publicOrderId: 'public-id-42',
          status: 'PENDING_PAYMENT',
          canCancelOrder: true,
          canChangePaymentMethod: true,
          items: [{ productName: 'Café', quantity: 1 }]
        }
      })
      .mockResolvedValueOnce({
        orderId: 42,
        publicOrderId: 'public-id-42',
        status: 'PREPARING',
        canCancelOrder: true,
        canChangePaymentMethod: true
      })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })

    await expect(mountedOrders.storeOrders.loadOrderByPublicId('public-id-42', 'email-token')).resolves.toBe('ok')
    const sharedOrder = mountedOrders.storeOrders.orders.value[0]
    expect(sharedOrder).toMatchObject({
      orderId: 42,
      publicOrderId: 'public-id-42',
      orderStatus: 'PENDING_PAYMENT',
      shared: true,
      canCancelOrder: true,
      canChangePaymentMethod: true
    })
    expect(sharedOrder.orderTrackingToken).toBe('email-token')
    expect(JSON.parse(localStorage.getItem('tiendario-orders-almacen-demo'))).toEqual([])

    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('ok')

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/orders/current', {
      orderTrackingToken: 'email-token'
    })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/orders/current', {
      orderTrackingToken: 'email-token'
    })
    expect(sharedOrder.orderStatus).toBe('PREPARING')
    expect(JSON.parse(localStorage.getItem('tiendario-orders-almacen-demo'))).toEqual([])
  })

  it('does not look up an order by public ID without a tracking token', async () => {
    const apiRequest = vi.fn()
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })

    await expect(mountedOrders.storeOrders.loadOrderByPublicId('public-id-42')).resolves.toBe('unavailable')

    expect(apiRequest).not.toHaveBeenCalled()
    expect(mountedOrders.storeOrders.orders.value).toEqual([])
  })

  it('restores a Mercado Pago return to local storage when the order is missing locally', async () => {
    const apiRequest = vi.fn().mockResolvedValue({
      orderId: 42,
      publicOrderId: 'public-id-42',
      status: 'PENDING_PAYMENT',
      paymentProvider: 'MERCADO_PAGO',
      items: [{ name: 'Café', quantity: 1 }]
    })
    rememberOrderTrackingToken('almacen-demo', 'public-id-42', 'return-token')
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })

    await expect(mountedOrders.storeOrders.loadOrderByPublicId(
      'public-id-42',
      '',
      { persistLocally: true }
    )).resolves.toBe('ok')

    expect(apiRequest).toHaveBeenCalledWith('/orders/current', {
      orderTrackingToken: 'return-token'
    })
    expect(mountedOrders.storeOrders.orders.value[0]).toMatchObject({
      orderId: 42,
      publicOrderId: 'public-id-42',
      orderStatus: 'PENDING_PAYMENT',
      paymentProvider: 'MERCADO_PAGO',
      shared: false
    })
    expect(JSON.parse(localStorage.getItem('tiendario-orders-almacen-demo'))[0])
      .toMatchObject({ orderId: 42, publicOrderId: 'public-id-42', orderStatus: 'PENDING_PAYMENT' })
  })

  it('keeps a completed shared order available long enough to show its final status', async () => {
    const apiRequest = vi.fn().mockResolvedValue({
      orderId: 42,
      publicOrderId: 'public-id-42',
      status: 'COMPLETED'
    })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })

    await expect(mountedOrders.storeOrders.loadOrderByPublicId('public-id-42', 'email-token')).resolves.toBe('ok')

    expect(mountedOrders.storeOrders.orders.value).toEqual([
      expect.objectContaining({
        orderId: 42,
        publicOrderId: 'public-id-42',
        orderStatus: 'COMPLETED',
        shared: true
      })
    ])
    expect(JSON.parse(localStorage.getItem('tiendario-orders-almacen-demo'))).toEqual([])
  })

  it('rejects a token that resolves to a different public order ID', async () => {
    const apiRequest = vi.fn().mockResolvedValue({
      orderId: 42,
      publicOrderId: 'another-public-id',
      status: 'PREPARING'
    })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })

    await expect(mountedOrders.storeOrders.loadOrderByPublicId('public-id-42', 'email-token'))
      .resolves.toBe('invalid-link')

    expect(apiRequest).toHaveBeenCalledWith('/orders/current', {
      orderTrackingToken: 'email-token'
    })
    expect(mountedOrders.storeOrders.orders.value).toEqual([])
    expect(sessionStorage.getItem('tiendario-order-tracking-almacen-demo-public-id-42')).toBeNull()
  })

  it('removes an order from local storage while preserving other saved orders', () => {
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'cancelled-token' })
    mountedOrders.storeOrders.addOrder({ orderId: 43, orderTrackingToken: 'active-token' })

    mountedOrders.storeOrders.removeOrder(42)

    expect(mountedOrders.storeOrders.orders.value.map((order) => order.orderId)).toEqual([43])
    expect(JSON.parse(localStorage.getItem('tiendario-orders-almacen-demo')).map((order) => order.orderId))
      .toEqual([43])
  })

  it('refreshes the order before cancellation and syncs the cancelled state after success', async () => {
    const apiRequest = vi.fn()
      .mockResolvedValueOnce({
        orderId: 42,
        status: 'CONFIRMED',
        canCancelOrder: true,
        cancellationDeadline: '2026-10-25T13:00:00.000Z'
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ orderId: 42, status: 'CANCELLED', canCancelOrder: false })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.cancelOrder(42, 'Ya no lo necesito.')).resolves.toBe('cancelled')

    expect(apiRequest.mock.calls).toEqual([
      ['/orders/current', { orderTrackingToken: 'private-token' }],
      ['/orders/current/cancellation', {
        method: 'POST',
        orderTrackingToken: 'private-token',
        body: { reason: 'Ya no lo necesito.' }
      }],
      ['/orders/current', { orderTrackingToken: 'private-token' }]
    ])
    expect(mountedOrders.storeOrders.orders.value[0]).toMatchObject({
      orderStatus: 'CANCELLED',
      canCancelOrder: false
    })
  })

  it('does not send cancellation if the refreshed order is not cancellable', async () => {
    const apiRequest = vi.fn().mockResolvedValue({
      orderId: 42,
      status: 'PREPARING',
      canCancelOrder: false
    })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.cancelOrder(42)).resolves.toBe('not-allowed')

    expect(apiRequest).toHaveBeenCalledOnce()
  })

  it('does not cancel when preparation has started even if the API flag is true', async () => {
    const apiRequest = vi.fn().mockResolvedValue({
      orderId: 42,
      status: 'PREPARING',
      canCancelOrder: true
    })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.cancelOrder(42)).resolves.toBe('not-allowed')

    expect(apiRequest).toHaveBeenCalledOnce()
  })

  it('changes payment method using the tracking token and refreshes the canonical order', async () => {
    const apiRequest = vi.fn()
      .mockResolvedValueOnce({
        orderId: 42,
        status: 'PENDING_PAYMENT',
        paymentProvider: 'MERCADO_PAGO',
        paymentStatus: 'PENDING',
        mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/old',
        canChangePaymentMethod: true,
        availablePaymentMethodChanges: [{ provider: 'TRANSFER', label: 'Transferencia' }]
      })
      .mockResolvedValueOnce({ orderId: 42, paymentProvider: 'TRANSFER' })
      .mockResolvedValueOnce({
        orderId: 42,
        status: 'AWAITING_PAYMENT_PROOF',
        paymentProvider: 'TRANSFER',
        paymentStatus: 'PENDING',
        transferAlias: 'tienda.alias',
        transferAccountHolder: 'Mi Tienda',
        canChangePaymentMethod: false,
        availablePaymentMethodChanges: []
      })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.changePaymentMethod(42, 'TRANSFER')).resolves.toBe('changed')

    expect(apiRequest.mock.calls).toEqual([
      ['/orders/current', { orderTrackingToken: 'private-token' }],
      ['/orders/current/payment-method', {
        method: 'PUT',
        orderTrackingToken: 'private-token',
        body: { paymentProvider: 'TRANSFER' }
      }],
      ['/orders/current', { orderTrackingToken: 'private-token' }]
    ])
    expect(mountedOrders.storeOrders.orders.value[0]).toMatchObject({
      orderStatus: 'AWAITING_PAYMENT_PROOF',
      paymentProvider: 'TRANSFER',
      transferAlias: 'tienda.alias',
      transferAccountHolder: 'Mi Tienda',
      mercadoPagoCheckoutUrl: null,
      canChangePaymentMethod: false,
      availablePaymentMethodChanges: []
    })
  })

  it('refreshes payment options after the selected method becomes unavailable', async () => {
    const apiRequest = vi.fn()
      .mockResolvedValueOnce({
        orderId: 42,
        status: 'PENDING_PAYMENT',
        paymentProvider: 'MERCADO_PAGO',
        canChangePaymentMethod: true,
        availablePaymentMethodChanges: [{ provider: 'TRANSFER', label: 'Transferencia' }]
      })
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), {
        status: 422,
        code: 'payment_method_unavailable'
      }))
      .mockResolvedValueOnce({
        orderId: 42,
        status: 'PENDING_PAYMENT',
        paymentProvider: 'MERCADO_PAGO',
        canChangePaymentMethod: true,
        availablePaymentMethodChanges: [{ provider: 'CASH', label: 'Efectivo' }]
      })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })

    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.changePaymentMethod(42, 'TRANSFER')).resolves.toBe('option-unavailable')

    expect(mountedOrders.storeOrders.orders.value[0].availablePaymentMethodChanges)
      .toEqual([{ provider: 'CASH', label: 'Efectivo' }])
  })

  it('recognizes a payment change completed despite a failed response', async () => {
    const apiRequest = vi.fn()
      .mockResolvedValueOnce({
        orderId: 42,
        status: 'PENDING_PAYMENT',
        paymentProvider: 'MERCADO_PAGO',
        canChangePaymentMethod: true,
        availablePaymentMethodChanges: [{ provider: 'TRANSFER', label: 'Transferencia' }]
      })
      .mockRejectedValueOnce(new Error('response connection lost'))
      .mockResolvedValueOnce({
        orderId: 42,
        status: 'AWAITING_PAYMENT_PROOF',
        paymentProvider: 'TRANSFER',
        canChangePaymentMethod: false,
        availablePaymentMethodChanges: []
      })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.changePaymentMethod(42, 'TRANSFER')).resolves.toBe('changed')
    expect(mountedOrders.storeOrders.orders.value[0].paymentProvider).toBe('TRANSFER')
  })

  it('refreshes and reports a cancellation deadline conflict', async () => {
    const apiRequest = vi.fn()
      .mockResolvedValueOnce({ orderId: 42, status: 'CONFIRMED', canCancelOrder: true })
      .mockRejectedValueOnce(Object.assign(new Error('conflict'), {
        status: 409,
        code: 'customer_cancellation_not_allowed'
      }))
      .mockResolvedValueOnce({ orderId: 42, status: 'PREPARING', canCancelOrder: false })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.cancelOrder(42)).resolves.toBe('not-allowed')

    expect(apiRequest).toHaveBeenCalledTimes(3)
    expect(mountedOrders.storeOrders.orders.value[0]).toMatchObject({
      orderStatus: 'PREPARING',
      canCancelOrder: false
    })
  })

  it('removes the local order if cancellation returns 404', async () => {
    const apiRequest = vi.fn()
      .mockResolvedValueOnce({ orderId: 42, status: 'CONFIRMED', canCancelOrder: true })
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.cancelOrder(42)).resolves.toBe('unavailable')

    expect(mountedOrders.storeOrders.orders.value).toEqual([])
    expect(JSON.parse(localStorage.getItem('tiendario-orders-almacen-demo'))).toEqual([])
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

  it('uses canonical order items from tracking when available', async () => {
    const apiRequest = vi.fn().mockResolvedValue({
      orderId: 42,
      status: 'PREPARING',
      items: [{ productName: 'Yerba', quantity: 2, unitSymbol: 'kg' }]
    })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({
      orderId: 42,
      orderTrackingToken: 'private-token',
      items: [{ name: 'Yerba antigua', quantity: 1 }]
    })

    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('ok')

    expect(mountedOrders.storeOrders.orders.value[0].items).toEqual([{
      name: 'Yerba',
      variantLabel: '',
      quantity: 2,
      unitSymbol: 'kg',
      decimalScale: 0
    }])
  })

  it('keeps the order and exposes an error on transient failures', async () => {
    const apiRequest = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }))
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.syncOrder(42)).resolves.toBe('error')
    expect(mountedOrders.storeOrders.orderErrors[42])
      .toBe('No se pudo actualizar el estado del pedido. Revisá tu conexión e intentá nuevamente.')
    expect(mountedOrders.storeOrders.orders.value).toHaveLength(1)
  })

  it('purges expired records and records with completed status during restore', () => {
    localStorage.setItem('tiendario-orders-almacen-demo', JSON.stringify([
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