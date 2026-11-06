import { describe, expect, it } from 'vitest'
import {
  isPendingMercadoPagoOrder,
  resolveMercadoPagoCheckoutUrl
} from './mercadoPagoCheckout.js'

describe('resolveMercadoPagoCheckoutUrl', () => {
  it('accepts HTTPS Checkout Pro URLs from Mercado Pago', () => {
    expect(resolveMercadoPagoCheckoutUrl('https://www.mercadopago.com.ar/checkout/redirect'))
      .toBe('https://www.mercadopago.com.ar/checkout/redirect')
  })

  it('returns an empty value when the API did not provide a payment URL', () => {
    expect(resolveMercadoPagoCheckoutUrl(undefined)).toBe('')
  })

  it('rejects malformed, insecure, and non-Mercado Pago URLs', () => {
    expect(() => resolveMercadoPagoCheckoutUrl('not a URL')).toThrow('URL de pago inválida')
    expect(() => resolveMercadoPagoCheckoutUrl('http://www.mercadopago.com.ar/checkout'))
      .toThrow('no pertenece a Mercado Pago')
    expect(() => resolveMercadoPagoCheckoutUrl('https://mercadopago.com.attacker.example/'))
      .toThrow('no pertenece a Mercado Pago')
    expect(() => resolveMercadoPagoCheckoutUrl('https://user@www.mercadopago.com.ar/checkout'))
      .toThrow('no pertenece a Mercado Pago')
  })
})

describe('isPendingMercadoPagoOrder', () => {
  it('uses the order status as the source of truth for Mercado Pago confirmation', () => {
    expect(isPendingMercadoPagoOrder({
      paymentProvider: 'MERCADO_PAGO',
      orderStatus: 'PENDING_PAYMENT',
      paymentStatus: 'APPROVED'
    })).toBe(true)
    expect(isPendingMercadoPagoOrder({
      paymentProvider: 'MERCADO_PAGO',
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PENDING'
    })).toBe(false)
  })

  it('does not label approved Mercado Pago orders as pending', () => {
    expect(isPendingMercadoPagoOrder({
      paymentProvider: 'MERCADO_PAGO',
      orderStatus: 'CONFIRMED',
      paymentStatus: 'APPROVED'
    })).toBe(false)
    expect(isPendingMercadoPagoOrder({ paymentProvider: 'CASH' })).toBe(false)
  })
})
