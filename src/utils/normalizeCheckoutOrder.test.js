import { describe, expect, it } from 'vitest'
import { normalizeCheckoutOrder } from './normalizeCheckoutOrder.js'

describe('normalizeCheckoutOrder', () => {
  it('attaches checkout credentials returned beside the order', () => {
    const order = { orderId: 42, publicOrderId: 'public-id-42', status: 'PENDING_PAYMENT' }

    expect(normalizeCheckoutOrder({
      order,
      orderTrackingToken: 'private-token',
      mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout'
    })).toEqual({
      order: {
        ...order,
        orderStatus: 'PENDING_PAYMENT',
        orderTrackingToken: 'private-token',
        mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout'
      },
      mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout'
    })
  })

  it('supports credentials nested in the data response', () => {
    expect(normalizeCheckoutOrder({
      data: {
        order: { orderId: 42, orderTrackingToken: 'order-token' },
        mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout'
      }
    })).toMatchObject({
      order: {
        orderId: 42,
        orderTrackingToken: 'order-token',
        mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout'
      },
      mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout'
    })
  })

  it('attaches a public order ID returned beside a nested order', () => {
    expect(normalizeCheckoutOrder({
      publicOrderId: 'public-id-42',
      orderTrackingToken: 'private-token',
      order: { orderId: 42, status: 'CONFIRMED' }
    }).order).toMatchObject({
      orderId: 42,
      publicOrderId: 'public-id-42',
      orderTrackingToken: 'private-token'
    })
  })

  it('normalizes a direct order in the data envelope', () => {
    expect(normalizeCheckoutOrder({
      data: {
        orderId: 42,
        status: 'PENDING_PAYMENT',
        orderTrackingToken: 'private-token'
      }
    }).order).toMatchObject({
      orderId: 42,
      status: 'PENDING_PAYMENT',
      orderStatus: 'PENDING_PAYMENT',
      orderTrackingToken: 'private-token'
    })
  })

  it('keeps a direct order response compatible', () => {
    const order = { orderId: 42, orderTrackingToken: 'private-token', status: 'CONFIRMED' }

    expect(normalizeCheckoutOrder(order).order).toMatchObject(order)
  })
})
