import { createApp, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisitorCart } from './useVisitorCart.js'

const product = {
  id: 'product-1',
  name: 'Manzana',
  productType: 'unit',
  pricePerType: 100,
  step: 1,
  minQuantity: 1,
  decimalScale: 0,
  unitSymbol: 'u',
  quantity: 1,
  maxQuantityPerOrder: 10,
  isSoldOut: false
}

const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload
})

const createMountedCart = () => {
  const products = reactive([{ ...product }])
  let cart
  const app = createApp({
    setup() {
      cart = useVisitorCart({ products })
      return () => null
    }
  })
  app.mount(document.createElement('div'))

  return { app, cart, products }
}

describe('useVisitorCart', () => {
  let mountedCart

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    mountedCart?.app.unmount()
    mountedCart = null
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('creates a bodyless visitor cart and persists its token under the store slug', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      cart: {
        id: 1,
        status: 'ACTIVE',
        revision: 0,
        subtotalAmount: '0',
        discountAmount: '0',
        totalAmount: '0',
        currency: 'ARS'
      },
      accessToken: 'opaque-token'
    }, 201))
    mountedCart = createMountedCart()

    await mountedCart.cart.initializeCart()

    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/stores/almacen-demo/carts')
    expect(options.method).toBe('POST')
    expect(options).not.toHaveProperty('body')
    expect(options.headers).not.toHaveProperty('X-Cart-Token')
    expect(url).not.toContain('opaque-token')
    expect(mountedCart.cart.cartToken.value).toBe('opaque-token')
    expect(JSON.parse(localStorage.getItem('vitrinapp-cart-almacen-demo'))).toMatchObject({
      token: 'opaque-token',
      revision: 0,
      items: []
    })
  })

  it('does not treat another store slug cart as the current cart', () => {
    mountedCart = createMountedCart()
    localStorage.setItem('vitrinapp-cart-cafe-del-barrio', JSON.stringify({
      token: 'another-store-token',
      items: [{ id: 'product-1', quantity: 2 }]
    }))

    expect(mountedCart.cart.hasSavedCartItems()).toBe(false)
  })

  it('sends the opaque token in the header and applies server revisions and discounts', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({
        cart: { revision: 0, subtotalAmount: '0', discountAmount: '0', totalAmount: '0', currency: 'ARS' },
        accessToken: 'opaque-token'
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        cart: {
          revision: 1,
          subtotalAmount: '100',
          discountAmount: '10',
          totalAmount: '90',
          currency: 'ARS',
          items: [{ productId: 'product-1', quantity: '1.000' }]
        }
      }))
    mountedCart = createMountedCart()

    await mountedCart.cart.initializeCart()
    mountedCart.cart.addToCart(mountedCart.products[0])
    await mountedCart.cart.flushCartRequests()

    const [url, options] = fetch.mock.calls[1]
    expect(url).toBe('/api/v1/stores/almacen-demo/carts/current/items/product-1')
    expect(options.method).toBe('PUT')
    expect(options.headers['X-Cart-Token']).toBe('opaque-token')
    expect(options.body).toBe(JSON.stringify({ quantity: '1.000', revision: 0 }))
    expect(url).not.toContain('opaque-token')
    expect(mountedCart.cart.cartRevision.value).toBe(1)
    expect(mountedCart.cart.subtotal.value).toBe(100)
    expect(mountedCart.cart.discountAmount.value).toBe(10)
    expect(mountedCart.cart.totalAmount.value).toBe(90)
  })

  it('sends the latest revision when removing an item', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({
        cart: { revision: 0, subtotalAmount: '0', discountAmount: '0', totalAmount: '0', currency: 'ARS' },
        accessToken: 'opaque-token'
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        cart: {
          revision: 1,
          subtotalAmount: '100',
          discountAmount: '0',
          totalAmount: '100',
          currency: 'ARS',
          items: [{ productId: 'product-1', quantity: '1.000' }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        cart: {
          revision: 2,
          subtotalAmount: '0',
          discountAmount: '0',
          totalAmount: '0',
          currency: 'ARS',
          items: []
        }
      }))
    mountedCart = createMountedCart()

    await mountedCart.cart.initializeCart()
    mountedCart.cart.addToCart(mountedCart.products[0])
    await mountedCart.cart.flushCartRequests()
    mountedCart.cart.updateCart('product-1', -1)
    await mountedCart.cart.flushCartRequests()

    const [url, options] = fetch.mock.calls[2]
    expect(url).toBe('/api/v1/stores/almacen-demo/carts/current/items/product-1')
    expect(options.method).toBe('DELETE')
    expect(options.headers['X-Cart-Token']).toBe('opaque-token')
    expect(options.body).toBe(JSON.stringify({ revision: 1 }))
    expect(mountedCart.cart.cartRevision.value).toBe(2)
    expect(mountedCart.cart.cartItems.value).toEqual([])
  })

  it('replaces an expired cart automatically without exposing an error', async () => {
    localStorage.setItem('vitrinapp-cart-almacen-demo', JSON.stringify({
      token: 'expired-token',
      revision: 3,
      items: [{ id: 'product-1', quantity: 2 }]
    }))
    fetch
      .mockResolvedValueOnce(jsonResponse({ error: 'cart expired' }, 404))
      .mockResolvedValueOnce(jsonResponse({
        cart: {
          id: 2,
          status: 'ACTIVE',
          revision: 0,
          subtotalAmount: '0',
          discountAmount: '0',
          totalAmount: '0',
          currency: 'ARS'
        },
        accessToken: 'replacement-token'
      }, 201))
    mountedCart = createMountedCart()
    mountedCart.cart.restoreCart()

    await mountedCart.cart.initializeCart()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/stores/almacen-demo/carts/current')
    expect(fetch.mock.calls[0][1].headers['X-Cart-Token']).toBe('expired-token')
    expect(fetch.mock.calls[1][0]).toBe('/api/v1/stores/almacen-demo/carts')
    expect(fetch.mock.calls[1][1].method).toBe('POST')
    expect(fetch.mock.calls[1][1]).not.toHaveProperty('body')
    expect(mountedCart.cart.cartToken.value).toBe('replacement-token')
    expect(mountedCart.cart.cartItems.value).toEqual([])
    expect(mountedCart.cart.cartError.value).toBe('')
    expect(JSON.parse(localStorage.getItem('vitrinapp-cart-almacen-demo'))).toMatchObject({
      token: 'replacement-token',
      revision: 0,
      items: []
    })
  })
})