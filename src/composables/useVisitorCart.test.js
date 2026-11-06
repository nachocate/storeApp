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
    expect(JSON.parse(localStorage.getItem('tiendario-cart-almacen-demo'))).toMatchObject({
      token: 'opaque-token',
      revision: 0,
      items: []
    })
  })

  it('does not treat another store slug cart as the current cart', () => {
    mountedCart = createMountedCart()
    localStorage.setItem('tiendario-cart-cafe-del-barrio', JSON.stringify({
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

  it('adds different variants as separate cart lines with their own variant IDs and prices', async () => {
    const variantProduct = {
      ...product,
      id: 'variant-product',
      productType: 'VARIANT',
      variantConfiguration: {
        options: [
          { name: 'Talle', displayType: 'TEXT', values: [{ label: 'M' }, { label: 'L' }] },
          { name: 'Color', displayType: 'COLOR_SWATCH', values: [{ label: 'Negro', swatchHex: '#111111' }] }
        ],
        variants: [
          {
            id: 45,
            label: 'Talle: M | Color: Negro',
            selections: [{ optionName: 'Talle', value: 'M' }, { optionName: 'Color', value: 'Negro' }],
            pricePerUnit: '35000.00',
            available: true,
            maxQuantityPerOrder: '2.000'
          },
          {
            id: 46,
            label: 'Talle: L | Color: Negro',
            selections: [{ optionName: 'Talle', value: 'L' }, { optionName: 'Color', value: 'Negro' }],
            pricePerUnit: '37000.00',
            available: true,
            maxQuantityPerOrder: '1.000'
          }
        ]
      }
    }
    fetch
      .mockResolvedValueOnce(jsonResponse({
        cart: { revision: 0, subtotalAmount: '0', discountAmount: '0', totalAmount: '0', currency: 'ARS' },
        accessToken: 'opaque-token'
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        cart: {
          revision: 1,
          items: [{ productId: 'variant-product', variantId: 45, variantLabel: 'Talle: M | Color: Negro', quantity: '1.000' }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        cart: {
          revision: 2,
          items: [
            { productId: 'variant-product', variantId: 45, variantLabel: 'Talle: M | Color: Negro', quantity: '1.000' },
            { productId: 'variant-product', variantId: 46, variantLabel: 'Talle: L | Color: Negro', quantity: '1.000' }
          ]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        cart: {
          revision: 3,
          items: [
            { productId: 'variant-product', variantId: 46, variantLabel: 'Talle: L | Color: Negro', quantity: '1.000' }
          ]
        }
      }))
    mountedCart = createMountedCart()
    mountedCart.products.push(variantProduct)
    await mountedCart.cart.initializeCart()

    mountedCart.cart.addToCart(variantProduct, 45)
    mountedCart.cart.addToCart(variantProduct, 46)
    expect(mountedCart.cart.cart.value).toHaveLength(2)
    await mountedCart.cart.flushCartRequests()

    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ variantId: 45 })
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({ variantId: 46 })
    expect(mountedCart.cart.cartItems.value.map(({ variantId, variantLabel, pricePerType }) => ({
      variantId,
      variantLabel,
      pricePerType
    }))).toEqual([
      { variantId: 45, variantLabel: 'Talle: M | Color: Negro', pricePerType: 35000 },
      { variantId: 46, variantLabel: 'Talle: L | Color: Negro', pricePerType: 37000 }
    ])

    mountedCart.cart.removeItem('variant-product', 45)
    await mountedCart.cart.flushCartRequests()
    expect(fetch.mock.calls[3][1].method).toBe('DELETE')
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toMatchObject({ variantId: 45 })
    expect(mountedCart.cart.cartItems.value.map((item) => item.variantId)).toEqual([46])
  })

  it('keeps other product additions available while syncing a cart mutation', async () => {
    const secondProduct = { ...product, id: 'product-2', name: 'Pera' }
    let resolveFirstMutation
    let resolveSecondMutation
    const firstMutation = new Promise((resolve) => {
      resolveFirstMutation = resolve
    })
    const secondMutation = new Promise((resolve) => {
      resolveSecondMutation = resolve
    })
    fetch
      .mockResolvedValueOnce(jsonResponse({
        cart: { revision: 0, subtotalAmount: '0', discountAmount: '0', totalAmount: '0', currency: 'ARS' },
        accessToken: 'opaque-token'
      }, 201))
      .mockReturnValueOnce(firstMutation)
      .mockReturnValueOnce(secondMutation)
    mountedCart = createMountedCart()
    mountedCart.products.push(secondProduct)
    await mountedCart.cart.initializeCart()

    mountedCart.cart.addToCart(mountedCart.products[0])
    expect(mountedCart.cart.isProductBusy('product-1')).toBe(false)
    expect(mountedCart.cart.isProductBusy('product-2')).toBe(false)

    const syncPromise = mountedCart.cart.flushCartRequests()
    expect(mountedCart.cart.isProductBusy('product-1')).toBe(true)
    mountedCart.cart.addToCart(secondProduct)
    expect(mountedCart.cart.cart.value).toEqual([
      { id: 'product-1', quantity: 1 },
      { id: 'product-2', quantity: 1 }
    ])
    expect(mountedCart.cart.isProductBusy('product-2')).toBe(false)

    resolveFirstMutation(jsonResponse({
      cart: { revision: 1, items: [{ productId: 'product-1', quantity: '1.000' }] }
    }))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(mountedCart.cart.isProductBusy('product-2')).toBe(true)
    expect(mountedCart.cart.cart.value).toEqual([
      { id: 'product-1', quantity: 1 },
      { id: 'product-2', quantity: 1 }
    ])
    resolveSecondMutation(jsonResponse({
      cart: {
        revision: 2,
        items: [
          { productId: 'product-1', quantity: '1.000' },
          { productId: 'product-2', quantity: '1.000' }
        ]
      }
    }))
    await syncPromise

    expect(mountedCart.cart.cart.value).toEqual([
      { id: 'product-1', quantity: 1 },
      { id: 'product-2', quantity: 1 }
    ])
    expect(mountedCart.cart.isProductBusy('product-1')).toBe(false)
    expect(mountedCart.cart.isProductBusy('product-2')).toBe(false)
  })

  it('debounces repeated quantity changes and sends only the final value', async () => {
    let resolveMutation
    const mutation = new Promise((resolve) => {
      resolveMutation = resolve
    })
    fetch
      .mockResolvedValueOnce(jsonResponse({
        cart: { revision: 0, subtotalAmount: '0', discountAmount: '0', totalAmount: '0', currency: 'ARS' },
        accessToken: 'opaque-token'
      }, 201))
      .mockReturnValueOnce(mutation)
    mountedCart = createMountedCart()
    await mountedCart.cart.initializeCart()

    mountedCart.cart.addToCart(mountedCart.products[0])
    mountedCart.cart.updateProductQuantity(mountedCart.products[0], 1)
    mountedCart.cart.updateProductQuantity(mountedCart.products[0], 1)

    expect(mountedCart.cart.cart.value).toEqual([{ id: 'product-1', quantity: 3 }])
    expect(mountedCart.cart.isProductBusy('product-1')).toBe(false)

    const syncPromise = mountedCart.cart.flushCartRequests()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify({ quantity: '3.000', revision: 0 }))
    expect(mountedCart.cart.isProductBusy('product-1')).toBe(true)
    resolveMutation(jsonResponse({
      cart: { revision: 1, items: [{ productId: 'product-1', quantity: '3.000' }] }
    }))
    await syncPromise

    expect(mountedCart.cart.isProductBusy('product-1')).toBe(false)
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
    localStorage.setItem('tiendario-cart-almacen-demo', JSON.stringify({
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
    expect(JSON.parse(localStorage.getItem('tiendario-cart-almacen-demo'))).toMatchObject({
      token: 'replacement-token',
      revision: 0,
      items: []
    })
  })

  it('adds and removes promotion bundles with the latest revision and replaces the cart', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ cart: { revision: 0 }, accessToken: 'opaque-token' }, 201))
      .mockResolvedValueOnce(jsonResponse({
        cart: { revision: 1, items: [{ productId: 'product-1', quantity: '2.000' }], discountAmount: '10' }
      }))
      .mockResolvedValueOnce(jsonResponse({ cart: { revision: 2, items: [] } }))
    mountedCart = createMountedCart()

    await mountedCart.cart.initializeCart()
    await expect(mountedCart.cart.addPromotionBundle(5)).resolves.toEqual({ ok: true })
    expect(mountedCart.cart.cart.value).toEqual([{ id: 'product-1', quantity: 2 }])
    await mountedCart.cart.removePromotionBundle(5)

    const [addUrl, addOptions] = fetch.mock.calls[1]
    expect(addUrl).toBe('/api/v1/stores/almacen-demo/carts/current/promotion-bundles/5/add')
    expect(addOptions.method).toBe('POST')
    expect(addOptions.headers['X-Cart-Token']).toBe('opaque-token')
    expect(addOptions.body).toBe(JSON.stringify({ revision: 0 }))
    const [removeUrl, removeOptions] = fetch.mock.calls[2]
    expect(removeUrl).toContain('/promotion-bundles/5/remove')
    expect(removeOptions.body).toBe(JSON.stringify({ revision: 1 }))
    expect(mountedCart.cart.cart.value).toEqual([])
  })

  it('reloads the cart and reports a friendly message on a revision conflict', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ cart: { revision: 0 }, accessToken: 'opaque-token' }, 201))
      .mockResolvedValueOnce(jsonResponse({ code: 'cart_revision_conflict' }, 409))
      .mockResolvedValueOnce(jsonResponse({ cart: { revision: 3, items: [] } }))
    mountedCart = createMountedCart()

    await mountedCart.cart.initializeCart()
    const result = await mountedCart.cart.addPromotionBundle(5)

    expect(result).toMatchObject({ ok: false, code: 'cart_revision_conflict' })
    expect(result.message).toMatch(/carrito cambió/)
    expect(fetch.mock.calls[2][0]).toContain('/carts/current')
    expect(mountedCart.cart.cartRevision.value).toBe(3)
  })
})