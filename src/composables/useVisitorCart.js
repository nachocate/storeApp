import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { requestStoreApi } from '../api/store.js'
import { STORE_SLUG } from '../config/store.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { formatQuantity, roundQuantity } from '../utils/quantityRules.js'
import { getBundleErrorMessage } from '../utils/normalizePromotion.js'

const CART_STORAGE_KEY = `vitrinapp-cart-${encodeURIComponent(STORE_SLUG)}`

export const useVisitorCart = ({ products }) => {
  const cartToken = ref('')
  const cartRevision = ref(null)
  const cart = ref([])
  const cartTotals = reactive({
    subtotalAmount: null,
    discountAmount: null,
    totalAmount: null,
    currency: 'ARS',
    discounts: []
  })
  const cartError = ref('')
  const cartLoading = ref(false)
  const busyProductIds = ref([])
  const busyPromotionId = ref(null)
  const isProductBusy = (productId) => busyProductIds.value.includes(productId)
  const productQty = ref({})
  const cartMutations = new Map()
  let cartDebounceTimer = null
  let cartSyncPromise = null

  const cartItems = computed(() => cart.value
    .map((entry) => {
      const product = products.find((item) => item.id === entry.id)
      return product ? { ...product, quantity: entry.quantity } : null
    })
    .filter(Boolean))

  const totalItems = computed(() => cartItems.value.reduce((sum, item) =>
    sum + (item.productType === 'weight' ? 1 : item.quantity), 0
  , 0))

  const localSubtotal = computed(() => cartItems.value.reduce(
    (sum, item) => sum + item.pricePerType * item.quantity,
    0
  ))

  const subtotal = computed(() => cartTotals.subtotalAmount ?? localSubtotal.value)
  const discountAmount = computed(() => cartTotals.discountAmount ?? 0)
  const totalAmount = computed(() =>
    cartTotals.totalAmount ?? Math.max(0, subtotal.value - discountAmount.value)
  )

  const persistCart = () => {
    if (typeof window === 'undefined') return

    try {
      if (!cartToken.value) {
        window.localStorage.removeItem(CART_STORAGE_KEY)
        return
      }

      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
        token: cartToken.value,
        revision: cartRevision.value,
        items: cart.value.map(({ id, quantity }) => ({ id, quantity }))
      }))
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  }

  watch(cart, persistCart, { deep: true })
  watch([cartToken, cartRevision], persistCart)

  const hasSavedCartItems = () => {
    if (typeof window === 'undefined') return false

    try {
      return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? 'null')?.items?.length > 0
    } catch {
      return false
    }
  }

  const restoreCart = () => {
    if (typeof window === 'undefined') return

    try {
      const savedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? 'null')
      if (!savedCart || typeof savedCart.token !== 'string' || !savedCart.token || !Array.isArray(savedCart.items)) {
        return
      }

      const items = savedCart.items.flatMap((entry) => {
        const product = products.find((item) => item.id === entry.id)
        const quantity = Number(entry.quantity)
        if (!product || !Number.isFinite(quantity) || quantity <= 0) return []

        const limit = Math.min(
          product.stock ?? Number.POSITIVE_INFINITY,
          product.maxQuantityPerOrder ?? Number.POSITIVE_INFINITY
        )
        if (limit < product.minQuantity) return []

        return [{ id: product.id, quantity: Math.min(limit, Math.max(product.minQuantity, quantity)) }]
      })

      cartToken.value = savedCart.token
      cartRevision.value = savedCart.revision ?? null
      cart.value = items
    } catch {
      cartToken.value = ''
      cartRevision.value = null
      cart.value = []
    }
  }

  const getProductLimit = (product) => Math.min(
    product.stock ?? Number.POSITIVE_INFINITY,
    product.maxQuantityPerOrder ?? Number.POSITIVE_INFINITY
  )

  const isUnavailable = (product) => product.isSoldOut || getProductLimit(product) <= 0

  const getCartQuantity = (productId) =>
    cart.value.find((item) => item.id === productId)?.quantity ?? 0

  const getProductQuantity = (product) => {
    const value = productQty.value[product.id]
    if (value !== undefined) return value

    const cartQuantity = getCartQuantity(product.id)
    const quantity = cartQuantity > 0 ? cartQuantity : product.quantity
    productQty.value[product.id] = quantity
    return quantity
  }

  const isProductLimitReached = (product) =>
    getProductQuantity(product) + product.step > getProductLimit(product)

  const formatQuantityLabel = (product) => formatQuantity(getProductQuantity(product), product)

  const formatCartQuantity = (quantity, product) => formatQuantity(quantity, product)

  const formatCartAmount = (amount) => formatCurrency(amount, cartTotals.currency || 'ARS')

  const cartData = (payload) => payload?.cart ?? payload?.data?.cart ?? payload?.data ?? payload ?? {}

  const readCartToken = (payload) => {
    const data = cartData(payload)
    return payload?.accessToken ?? payload?.cartToken ?? payload?.token ??
      payload?.data?.accessToken ?? data.accessToken ?? data.cartToken ?? data.token ?? ''
  }

  const updateCartRevision = (payload) => {
    const data = cartData(payload)
    const revision = payload?.revision ?? payload?.cartRevision ?? data.revision ?? data.cartRevision
    if (revision !== undefined && revision !== null) cartRevision.value = revision
  }

  const updateCartTotals = (payload) => {
    const data = cartData(payload)
    for (const key of ['subtotalAmount', 'discountAmount', 'totalAmount']) {
      const amount = Number(data[key])
      if (data[key] !== undefined && data[key] !== null && Number.isFinite(amount)) {
        cartTotals[key] = amount
      }
    }
    if (data.currency) cartTotals.currency = data.currency
    if (Array.isArray(data.discounts)) cartTotals.discounts = data.discounts
  }

  const applyCartSnapshot = (payload) => {
    const data = cartData(payload)
    const token = readCartToken(payload)
    if (token) cartToken.value = token
    updateCartRevision(payload)
    updateCartTotals(payload)

    if (!Array.isArray(data.items)) return
    cart.value = data.items.flatMap((entry) => {
      const id = entry.productId ?? entry.product?.id ?? entry.id
      const quantity = Number(entry.quantity)
      return id != null && Number.isFinite(quantity) && quantity > 0
        ? [{ id, quantity }]
        : []
    })
    for (const item of cart.value) productQty.value[item.id] = item.quantity
  }

  const ensureCart = async () => {
    if (cartToken.value) return
    const createdCart = await requestStoreApi('/carts', { method: 'POST' })
    cartToken.value = readCartToken(createdCart)
    updateCartRevision(createdCart)
    updateCartTotals(createdCart)
    if (!cartToken.value) throw new Error('La API no devolvió el token del carrito.')
  }

  const refreshCurrentCart = async () => {
    const currentCart = await requestStoreApi('/carts/current', { cartToken: cartToken.value })
    applyCartSnapshot(currentCart)
  }

  const clearCartState = () => {
    cart.value = []
    cartToken.value = ''
    cartRevision.value = null
    Object.assign(cartTotals, {
      subtotalAmount: null,
      discountAmount: null,
      totalAmount: null,
      currency: 'ARS',
      discounts: []
    })
    productQty.value = {}
    persistCart()
  }

  const initializeCart = async () => {
    cartLoading.value = true
    cartError.value = ''
    try {
      if (cartToken.value) {
        await refreshCurrentCart()
      } else {
        await ensureCart()
      }
    } catch (error) {
      if (error.status === 404 && cartToken.value) {
        clearCartState()
        try {
          await ensureCart()
        } catch {
          cartError.value = 'No pudo crearse el carrito, contáctese con el proveedor del servicio.'
        }
      } else if (!cartToken.value) {
        cartError.value = 'No pudo crearse el carrito, contáctese con el proveedor del servicio.'
      } else {
        cartError.value = error.message || 'No se pudo crear o recuperar el carrito.'
      }
    } finally {
      cartLoading.value = false
      persistCart()
    }
  }

  const sendCartMutation = async (productId, quantity) => {
    if ((quantity === null || quantity <= 0) && !cartToken.value) return
    await ensureCart()
    if (cartRevision.value === null) await refreshCurrentCart()
    if (cartRevision.value === null) throw new Error('La API no devolvió la revisión del carrito.')

    const removing = quantity === null || quantity <= 0
    const response = await requestStoreApi(`/carts/current/items/${encodeURIComponent(productId)}`, {
      method: removing ? 'DELETE' : 'PUT',
      cartToken: cartToken.value,
      body: removing
        ? { revision: cartRevision.value }
        : { quantity: Number(quantity).toFixed(3), revision: cartRevision.value }
    })
    const previousRevision = cartRevision.value
    if (response) applyCartSnapshot(response)
    if (response == null || cartRevision.value === previousRevision) await refreshCurrentCart()
  }

  const flushCartRequests = () => {
    if (cartDebounceTimer) {
      clearTimeout(cartDebounceTimer)
      cartDebounceTimer = null
    }
    if (cartSyncPromise) return cartSyncPromise
    if (cartMutations.size === 0) return Promise.resolve()

    cartLoading.value = true
    cartError.value = ''
    busyProductIds.value = [...cartMutations.keys()]
    cartSyncPromise = (async () => {
      try {
        while (cartMutations.size > 0) {
          const [productId, quantity] = cartMutations.entries().next().value
          cartMutations.delete(productId)
          try {
            await sendCartMutation(productId, quantity)
          } finally {
            busyProductIds.value = busyProductIds.value.filter((id) => id !== productId)
          }
        }
      } catch (error) {
        cartMutations.clear()
        cartError.value = error.message || 'No se pudo actualizar el carrito.'
        if (cartToken.value) {
          try {
            await refreshCurrentCart()
          } catch {
            // Keep the last locally saved cart visible when recovery is unavailable.
          }
        }
      } finally {
        busyProductIds.value = []
        cartLoading.value = false
        cartSyncPromise = null
        persistCart()
      }
    })()
    return cartSyncPromise
  }

  const queueCartRequest = (productId, quantity) => {
    cartMutations.set(productId, quantity)
    if (cartDebounceTimer) clearTimeout(cartDebounceTimer)
    cartDebounceTimer = setTimeout(() => void flushCartRequests(), 350)
  }

  const updateProductQuantity = (product, delta) => {
    if (isUnavailable(product) || cartLoading.value) return

    const current = getProductQuantity(product)
    const next = Math.min(
      getProductLimit(product),
      Math.max(product.minQuantity, roundQuantity(current + delta, product.decimalScale))
    )
    productQty.value[product.id] = next

    const existing = cart.value.find((item) => item.id === product.id)
    if (existing) {
      existing.quantity = next
      queueCartRequest(product.id, next)
    }
  }

  const addToCart = (product) => {
    if (isUnavailable(product) || cartLoading.value) return

    const quantity = getProductQuantity(product)
    const existing = cart.value.find((item) => item.id === product.id)
    const nextQuantity = Math.min(getProductLimit(product), (existing?.quantity ?? 0) + quantity)
    if (nextQuantity <= (existing?.quantity ?? 0)) return

    if (existing) {
      existing.quantity = nextQuantity
    } else {
      cart.value.push({ id: product.id, quantity: nextQuantity })
    }
    productQty.value[product.id] = nextQuantity
    queueCartRequest(product.id, nextQuantity)
  }

  const updateCart = (productId, delta) => {
    if (cartLoading.value) return

    const item = cart.value.find((entry) => entry.id === productId)
    const product = products.find((entry) => entry.id === productId)
    if (!item || !product) return

    const nextQuantity = roundQuantity(item.quantity + product.step * delta, product.decimalScale)
    if (nextQuantity === item.quantity) return

    if (nextQuantity < product.minQuantity) {
      cart.value = cart.value.filter((entry) => entry.id !== productId)
      productQty.value[productId] = product.quantity
      queueCartRequest(productId, null)
      return
    }

    item.quantity = Math.min(getProductLimit(product), nextQuantity)
    productQty.value[productId] = item.quantity
    queueCartRequest(productId, item.quantity)
  }

  const removeItem = (productId) => {
    if (cartLoading.value) return
    const product = products.find((entry) => entry.id === productId)
    if (!product) return

    cart.value = cart.value.filter((entry) => entry.id !== productId)
    productQty.value[productId] = product.minQuantity
    queueCartRequest(productId, null)
  }

  const sendPromotionBundle = async (promotionId, action) => {
    await flushCartRequests()
    await ensureCart()
    if (cartRevision.value === null) await refreshCurrentCart()
    if (cartRevision.value === null) throw new Error('La API no devolvió la revisión del carrito.')

    const response = await requestStoreApi(
      `/carts/current/promotion-bundles/${encodeURIComponent(promotionId)}/${action}`,
      { method: 'POST', cartToken: cartToken.value, body: { revision: cartRevision.value } }
    )
    applyCartSnapshot(response)
  }

  // Bundle requests run one at a time so each one uses the revision returned by the previous one.
  let bundleQueue = Promise.resolve()
  const mutatePromotionBundle = (promotionId, action) => {
    const run = async () => {
      cartLoading.value = true
      cartError.value = ''
      busyPromotionId.value = promotionId
      try {
        await sendPromotionBundle(promotionId, action)
        return { ok: true }
      } catch (error) {
        // A conflict may leave the local cart stale; the user retries manually.
        if (error.code === 'cart_revision_conflict' && cartToken.value) {
          try {
            await refreshCurrentCart()
          } catch {
            // Keep the last known cart visible when recovery is unavailable.
          }
        }
        cartError.value = ''
        return { ok: false, code: error.code, message: getBundleErrorMessage(error) }
      } finally {
        busyPromotionId.value = null
        cartLoading.value = false
        persistCart()
      }
    }
    const result = bundleQueue.then(run)
    bundleQueue = result
    return result
  }

  const addPromotionBundle = (promotionId) => mutatePromotionBundle(promotionId, 'add')
  const removePromotionBundle = (promotionId) => mutatePromotionBundle(promotionId, 'remove')

  const clearCompletedCart = (order) => {
    if (!order || order.cartToken !== cartToken.value) return
    clearCartState()
  }

  onBeforeUnmount(() => {
    if (cartDebounceTimer) clearTimeout(cartDebounceTimer)
  })

  return {
    addPromotionBundle,
    addToCart,
    busyPromotionId,
    cart,
    cartError,
    cartItems,
    cartLoading,
    cartRevision,
    cartToken,
    cartTotals,
    clearCompletedCart,
    discountAmount,
    flushCartRequests,
    formatCartAmount,
    formatCartQuantity,
    formatQuantityLabel,
    getCartQuantity,
    getProductLimit,
    getProductQuantity,
    hasSavedCartItems,
    initializeCart,
    isProductBusy,
    isProductLimitReached,
    isUnavailable,
    productQty,
    refreshCurrentCart,
    removeItem,
    removePromotionBundle,
    restoreCart,
    subtotal,
    totalAmount,
    totalItems,
    updateCart,
    updateProductQuantity
  }
}