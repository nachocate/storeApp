import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl, resolveRequestedOrderId, resolveSubdomainSlug } from './store.js'

describe('resolveSubdomainSlug', () => {
  const base = 'tiendario.cloud'

  it('extracts the slug from a store subdomain', () => {
    expect(resolveSubdomainSlug('mi-tienda.tiendario.cloud', base)).toBe('mi-tienda')
    expect(resolveSubdomainSlug('Mi-Tienda.tiendario.cloud', base)).toBe('mi-tienda')
  })

  it('ignores the base domain, reserved, nested and foreign hosts', () => {
    expect(resolveSubdomainSlug('tiendario.cloud', base)).toBe('')
    expect(resolveSubdomainSlug('dev.tiendario.cloud', base)).toBe('')
    expect(resolveSubdomainSlug('www.tiendario.cloud', base)).toBe('')
    expect(resolveSubdomainSlug('a.b.tiendario.cloud', base)).toBe('')
    expect(resolveSubdomainSlug('localhost', base)).toBe('')
  })
})

describe('resolveApiBaseUrl', () => {
  it('returns an empty value when no environment variable is defined', () => {
    expect(resolveApiBaseUrl()).toBe('')
  })

  it('uses API_BASE_URL and removes its trailing slash', () => {
    expect(resolveApiBaseUrl({ API_BASE_URL: 'https://api.example.com/' }))
      .toBe('https://api.example.com')
  })

  it('returns an empty value for an invalid configured value', () => {
    expect(resolveApiBaseUrl({ API_BASE_URL: 'not a url' })).toBe('')
  })
})

describe('resolveRequestedOrderId', () => {
  it('reads an order id from a store order path', () => {
    expect(resolveRequestedOrderId('/almacen-demo/orders/order-42')).toBe('order-42')
    expect(resolveRequestedOrderId('/almacen-demo/orders/order%2F42')).toBe('order/42')
  })

  it('reads an order id from a query without reading tracking credentials', () => {
    expect(resolveRequestedOrderId('/almacen-demo', '?orderId=order-42&token=secret'))
      .toBe('order-42')
    expect(resolveRequestedOrderId('/almacen-demo', '?orderId=order%252F42')).toBe('order%2F42')
  })

  it('reads an order id from a subdomain order path', () => {
    expect(resolveRequestedOrderId('/orders/order-42', '', false)).toBe('order-42')
  })

  it('returns an empty value when no order id is present', () => {
    expect(resolveRequestedOrderId('/almacen-demo/cart')).toBe('')
  })
})
