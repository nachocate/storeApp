import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { requestStoreApi } from '../api/store.js'
import { STORE_SLUG } from '../config/store.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { formatQuantity, roundQuantity } from '../utils/quantityRules.js'
import { getBundleErrorMessage } from '../utils/normalizePromotion.js'

const CART_STORAGE_KEY = `tiendario-cart-${encodeURIComponent(STORE_SLUG)}`

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
  const cartInitializing = ref(false)
  const busyProductIds = ref([])
  const busyPromotionId = ref(null)
  const productQty = ref({})
  const cartMutations = new Map()
  let cartDebounceTimer = null
  let cartSyncPromise = null

  const cartLineKey = (productId, variantId = null) => `${productId}:${variantId ?? ''}`
  const isProductBusy = (productId, variantId = null) =>
    busyProductIds.value.includes(cartLineKey(productId, variantId))
  const getProductVariant = (product, variantId) =>
    product?.variantConfiguration?.variants?.find((variant) => variant.id === variantId) ?? null

  const cartItems = computed(() => cart.value
    .map((entry) => {
      const product = products.find((item) => item.id === entry.id)
      if (!product) return null
      const variant = entry.variantId == null ? null : getProductVariant(product, entry.variantId)
      return {
        ...product,
        id: product.id,
        lineId: cartLineKey(product.id, entry.variantId),
        variantId: entry.variantId ?? null,
        variantLabel: entry.variantLabel ?? variant?.label ?? '',
        pricePerType: variant
          ? Number(variant.pricePerUnit)
          : entry.unitPrice == null ? product.pricePerType : Number(entry.unitPrice),
        maxQuantityPerOrder: variant
          ? variant.maxQuantityPerOrder == null ? null : Number(variant.maxQuantityPerOrder)
          : product.maxQuantityPerOrder,
        isSoldOut: variant ? !variant.available : entry.variantId != null || product.isSoldOut,
        quantity: entry.quantity
      }
    })
    .filter(Boolean))

  const totalItems = computed(() => cartItems.value.reduce(
    (sum, item) => sum + (item.quantityType === 'weight' || item.decimalScale > 0 ? 1 : item.quantity),
    0
  ))

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
        items: cart.value.map(({ id, variantId, quantity }) => ({
          id,
          ...(variantId == null ? {} : { variantId }),
          quantity
        }))
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
        const variant = entry.variantId == null ? null : getProductVariant(product, entry.variantId)
        const quantity = Number(entry.quantity)
        if (!product || (product.productType === 'VARIANT' && (!variant || !variant.available)) ||
          (entry.variantId != null && !variant) ||
          !Number.isFinite(quantity) || quantity <= 0) return []

        const limit = Math.min(
          variant
            ? variant.maxQuantityPerOrder ?? Number.POSITIVE_INFINITY
            : product.maxQuantityPerOrder ?? Number.POSITIVE_INFINITY
        )
        if (limit < product.minQuantity) return []

        return [{
          id: product.id,
          ...(entry.variantId == null ? {} : { variantId: entry.variantId }),
          quantity: Math.min(limit, Math.max(product.minQuantity, quantity))
        }]
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

  const getProductLimit = (product, variantId = null) => Math.min(
    variantId == null ? product.stock ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY,
    variantId == null
      ? product.maxQuantityPerOrder ?? Number.POSITIVE_INFINITY
      : getProductVariant(product, variantId)?.maxQuantityPerOrder ?? Number.POSITIVE_INFINITY
  )

  const isUnavailable = (product, variantId = null) => variantId == null
    ? product.isSoldOut || getProductLimit(product) <= 0
    : !getProductVariant(product, variantId)?.available || getProductLimit(product, variantId) <= 0

  const getCartQuantity = (productId, variantId = null) =>
    cart.value.find((item) => item.id === productId && (item.variantId ?? null) === variantId)?.quantity ?? 0

  const getProductQuantity = (product, variantId = null) => {
    const key = cartLineKey(product.id, variantId)
    const value = productQty.value[key]
    if (value !== undefined) return value

    const cartQuantity = getCartQuantity(product.id, variantId)
    const quantity = cartQuantity > 0 ? cartQuantity : product.quantity
    productQty.value[key] = quantity
    return quantity
  }

  const isProductLimitReached = (product, variantId = null) =>
    getProductQuantity(product, variantId) + product.step > getProductLimit(product, variantId)

  const formatQuantityLabel = (product, variantId = null) =>
    formatQuantity(getProductQuantity(product, variantId), product)

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
    const snapshotItems = data.items.flatMap((entry) => {
      const id = entry.productId ?? entry.product?.id ?? entry.id
      const variantId = entry.variantId ?? entry.variant?.id ?? null
      const quantity = Number(entry.quantity)
      return id != null && Number.isFinite(quantity) && quantity > 0
        ? [{
          id,
          ...(variantId == null ? {} : {
            variantId,
            variantLabel: entry.variantLabel ?? entry.variant?.label ?? '',
            ...(entry.unitPrice == null ? {} : { unitPrice: entry.unitPrice }),
            ...(entry.name == null ? {} : { name: entry.name })
          }),
          quantity
        }]
        : []
    })
    const lines = new Map(snapshotItems.map((item) => [cartLineKey(item.id, item.variantId), item]))
    for (const mutation of cartMutations.values()) {
      const key = cartLineKey(mutation.productId, mutation.variantId)
      if (mutation.quantity == null || mutation.quantity <= 0) {
        lines.delete(key)
      } else {
        const product = products.find((item) => item.id === mutation.productId)
        const variant = mutation.variantId == null ? null : getProductVariant(product, mutation.variantId)
        lines.set(key, {
          id: mutation.productId,
          ...(mutation.variantId == null ? {} : {
            variantId: mutation.variantId,
            variantLabel: variant?.label ?? '',
            ...(variant?.pricePerUnit == null ? {} : { unitPrice: variant.pricePerUnit })
          }),
          quantity: mutation.quantity
        })
      }
    }
    cart.value = [...lines.values()]
    for (const item of cart.value) {
      productQty.value[cartLineKey(item.id, item.variantId)] = item.quantity
    }
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
    cartInitializing.value = true
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
      cartInitializing.value = false
      cartLoading.value = false
      persistCart()
    }
  }

  const sendCartMutation = async (productId, variantId, quantity) => {
    if ((quantity === null || quantity <= 0) && !cartToken.value) return
    await ensureCart()
    if (cartRevision.value === null) await refreshCurrentCart()
    if (cartRevision.value === null) throw new Error('La API no devolvió la revisión del carrito.')

    const removing = quantity === null || quantity <= 0
    const response = await requestStoreApi(`/carts/current/items/${encodeURIComponent(productId)}`, {
      method: removing ? 'DELETE' : 'PUT',
      cartToken: cartToken.value,
      body: removing
        ? { revision: cartRevision.value, ...(variantId == null ? {} : { variantId }) }
        : {
          quantity: Number(quantity).toFixed(3),
          revision: cartRevision.value,
          ...(variantId == null ? {} : { variantId })
        }
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
    cartSyncPromise = (async () => {
      try {
        while (cartMutations.size > 0) {
          const [key, mutation] = cartMutations.entries().next().value
          cartMutations.delete(key)
          if (!busyProductIds.value.includes(key)) {
            busyProductIds.value = [...busyProductIds.value, key]
          }
          try {
            await sendCartMutation(mutation.productId, mutation.variantId, mutation.quantity)
          } finally {
            if (!cartMutations.has(key)) {
              busyProductIds.value = busyProductIds.value.filter((id) => id !== key)
            }
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

  const queueCartRequest = (productId, variantId, quantity) => {
    cartMutations.set(cartLineKey(productId, variantId), { productId, variantId, quantity })
    if (cartDebounceTimer) clearTimeout(cartDebounceTimer)
    cartDebounceTimer = setTimeout(() => void flushCartRequests(), 350)
  }

  const updateProductQuantity = (product, delta, variantId = null) => {
    if (isUnavailable(product, variantId) || cartInitializing.value || busyPromotionId.value !== null) return

    const current = getProductQuantity(product, variantId)
    const next = Math.min(
      getProductLimit(product, variantId),
      Math.max(product.minQuantity, roundQuantity(current + delta, product.decimalScale))
    )

    const existing = cart.value.find((item) =>
      item.id === product.id && (item.variantId ?? null) === variantId
    )
    productQty.value[cartLineKey(product.id, variantId)] = next
    if (existing) {
      existing.quantity = next
      queueCartRequest(product.id, variantId, next)
    }
  }

  const addToCart = (product, variantId = null) => {
    if ((product.productType === 'VARIANT' && variantId == null) ||
      isUnavailable(product, variantId) || cartInitializing.value || busyPromotionId.value !== null) return

    const lineKey = cartLineKey(product.id, variantId)
    const quantity = getProductQuantity(product, variantId)
    const existing = cart.value.find((item) =>
      item.id === product.id && (item.variantId ?? null) === variantId
    )
    const nextQuantity = Math.min(getProductLimit(product, variantId), (existing?.quantity ?? 0) + quantity)
    if (nextQuantity <= (existing?.quantity ?? 0)) return

    if (existing) {
      existing.quantity = nextQuantity
    } else {
      const variant = variantId == null ? null : getProductVariant(product, variantId)
      cart.value.push({
        id: product.id,
        ...(variantId == null ? {} : { variantId, variantLabel: variant?.label ?? '' }),
        quantity: nextQuantity
      })
    }
    productQty.value[lineKey] = nextQuantity
    queueCartRequest(product.id, variantId, nextQuantity)
  }

  const updateCart = (productId, delta, variantId = null) => {
    if (cartLoading.value) return

    const item = cart.value.find((entry) => entry.id === productId && (entry.variantId ?? null) === variantId)
    const product = products.find((entry) => entry.id === productId)
    if (!item || !product) return

    const nextQuantity = roundQuantity(item.quantity + product.step * delta, product.decimalScale)
    if (nextQuantity === item.quantity) return

    if (nextQuantity < product.minQuantity) {
      cart.value = cart.value.filter((entry) =>
        entry.id !== productId || (entry.variantId ?? null) !== variantId
      )
      productQty.value[cartLineKey(productId, variantId)] = product.quantity
      queueCartRequest(productId, variantId, null)
      return
    }

    item.quantity = Math.min(getProductLimit(product, variantId), nextQuantity)
    productQty.value[cartLineKey(productId, variantId)] = item.quantity
    queueCartRequest(productId, variantId, item.quantity)
  }

  const removeItem = (productId, variantId = null) => {
    if (cartLoading.value) return
    const product = products.find((entry) => entry.id === productId)
    if (!product) return

    cart.value = cart.value.filter((entry) =>
      entry.id !== productId || (entry.variantId ?? null) !== variantId
    )
    productQty.value[cartLineKey(productId, variantId)] = product.minQuantity
    queueCartRequest(productId, variantId, null)
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
    cartInitializing,
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