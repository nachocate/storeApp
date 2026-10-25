import { ref, reactive } from 'vue'
import { requestStoreApi } from '../api/store.js'
import { STORE_SLUG } from '../config/store.js'
import { normalizeStatusTimeline } from '../utils/orderStatusStyles.js'
import { normalizeOrderItems, readOrderItems } from '../utils/orderItems.js'

const ORDER_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_PROOF_SIZE = 5 * 1024 * 1024
const ACCEPTED_PROOF_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const CANCELLABLE_ORDER_STATUSES = new Set([
  'PENDING',
  'PENDING_AVAILABILITY',
  'PENDING_PAYMENT',
  'AWAITING_PAYMENT',
  'AWAITING_PAYMENT_PROOF',
  'PAYMENT_PROOF_UNDER_REVIEW',
  'PAYMENT_UNDER_REVIEW',
  'UNDER_REVIEW',
  'CONFIRMED'
])
const PAYMENT_PROVIDERS = new Set(['CASH', 'TRANSFER', 'MERCADO_PAGO'])

const isOrderCancellable = (order) =>
  order?.canCancelOrder === true &&
  CANCELLABLE_ORDER_STATUSES.has(String(order.orderStatus ?? '').trim().toUpperCase())

const normalizePaymentMethodChanges = (changes) => {
  if (!Array.isArray(changes)) return []

  return changes.filter((change) =>
    PAYMENT_PROVIDERS.has(change?.provider) &&
    typeof change.label === 'string' &&
    change.label.trim()
  ).map((change) => ({ provider: change.provider, label: change.label.trim() }))
}

export const useStoreOrders = ({
  storeSlug = STORE_SLUG,
  apiRequest = requestStoreApi,
  now = () => Date.now()
} = {}) => {
  const storageKey = `vitrinapp-orders-${encodeURIComponent(storeSlug)}`
  const orders = ref([])
  const orderErrors = reactive({})
  const transferErrors = reactive({})
  const transferSuccess = reactive({})
  const uploadingProofs = reactive({})

  const persistOrders = () => {
    if (typeof window === 'undefined') return false
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(orders.value))
      return true
    } catch {
      return false
    }
  }

  const restoreOrders = () => {
    if (typeof window === 'undefined') return
    try {
      const savedOrders = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
      const currentTime = now()
      orders.value = Array.isArray(savedOrders)
        ? savedOrders.filter((order) =>
          typeof order?.orderTrackingToken === 'string' &&
          order.orderTrackingToken.length > 0 &&
          Number(order.expiresAt) > currentTime &&
          order.orderStatus !== 'COMPLETED'
        )
        : []
      persistOrders()
    } catch {
      orders.value = []
      persistOrders()
    }
  }

  const addOrder = (order) => {
    if (order?.orderId === undefined || order?.orderId === null || !String(order.orderId).trim()) {
      throw new Error('La API no devolvio el identificador del pedido.')
    }
    if (typeof order.orderTrackingToken !== 'string' || !order.orderTrackingToken) {
      throw new Error('La API no devolvio el token de seguimiento del pedido.')
    }
    const createdAt = order.createdAt ?? new Date(now()).toISOString()
    const record = {
      orderId: order.orderId,
      orderTrackingToken: order.orderTrackingToken,
      orderStatus: order.orderStatus ?? order.status,
      items: normalizeOrderItems(order.items),
      paymentProvider: order.paymentProvider,
      paymentStatus: order.paymentStatus,
      mercadoPagoCheckoutUrl: order.mercadoPagoCheckoutUrl ?? null,
      fulfillmentType: order.fulfillmentType,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt,
      scheduledDate: order.scheduledDate,
      scheduledStartsAt: order.scheduledStartsAt,
      scheduledEndsAt: order.scheduledEndsAt,
      transferAlias: order.transferAlias,
      transferAccountHolder: order.transferAccountHolder,
      canCancelOrder: order.canCancelOrder === true,
      cancellationDeadline: order.cancellationDeadline,
      canChangePaymentMethod: order.canChangePaymentMethod === true,
      availablePaymentMethodChanges: normalizePaymentMethodChanges(order.availablePaymentMethodChanges),
      expiresAt: now() + ORDER_TTL_MS
    }
    orders.value = [record, ...orders.value.filter((item) => item.orderId !== record.orderId)]
    if (!persistOrders()) throw new Error('No se pudo guardar el pedido en este navegador.')
    return record
  }

  const removeOrder = (orderId) => {
    orders.value = orders.value.filter((order) => order.orderId !== orderId)
    delete orderErrors[orderId]
    delete transferErrors[orderId]
    delete transferSuccess[orderId]
    delete uploadingProofs[orderId]
    persistOrders()
  }

  // Used by the tracking view: keeps finished orders visible and reports lost access explicitly.
  const syncOrder = async (orderId) => {
    const order = orders.value.find((item) => item.orderId === orderId)
    if (!order || Number(order.expiresAt) <= now()) {
      if (order) removeOrder(orderId)
      return 'unavailable'
    }

    try {
      const current = await apiRequest('/orders/current', {
        orderTrackingToken: order.orderTrackingToken
      })
      if (String(current.orderId) !== String(orderId)) {
        removeOrder(orderId)
        return 'unavailable'
      }
      const orderStatus = current.status ?? current.orderStatus
      if (orderStatus === 'COMPLETED') {
        removeOrder(orderId)
        return 'completed'
      }
      const currentItems = readOrderItems(current)
      Object.assign(order, {
        orderStatus,
        ...(currentItems.length ? { items: currentItems } : {}),
        paymentProvider: current.paymentProvider ?? null,
        paymentStatus: current.paymentStatus ?? null,
        mercadoPagoCheckoutUrl: current.mercadoPagoCheckoutUrl ?? null,
        fulfillmentType: current.fulfillmentType ?? null,
        totalAmount: current.totalAmount ?? null,
        currency: current.currency ?? null,
        createdAt: current.createdAt ?? null,
        scheduledDate: current.scheduledDate ?? null,
        scheduledStartsAt: current.scheduledStartsAt ?? null,
        scheduledEndsAt: current.scheduledEndsAt ?? null,
        transferAlias: current.transferAlias ?? null,
        transferAccountHolder: current.transferAccountHolder ?? null,
        canCancelOrder: current.canCancelOrder === true,
        cancellationDeadline: current.cancellationDeadline ?? null,
        canChangePaymentMethod: current.canChangePaymentMethod === true,
        availablePaymentMethodChanges: normalizePaymentMethodChanges(current.availablePaymentMethodChanges),
        statusTimeline: normalizeStatusTimeline(current.statusTimeline)
      })
      delete orderErrors[orderId]
      persistOrders()
      return 'ok'
    } catch (error) {
      if (error.status === 401 || error.status === 404) {
        removeOrder(orderId)
        return 'unavailable'
      }
      orderErrors[orderId] = 'No se pudo actualizar el estado del pedido. Revisá tu conexión e intentá nuevamente.'
      return 'error'
    }
  }

  const changePaymentMethod = async (orderId, paymentProvider) => {
    const order = orders.value.find((item) => item.orderId === orderId)
    if (!order) return 'unavailable'
    if (!PAYMENT_PROVIDERS.has(paymentProvider)) return 'invalid-option'

    const currentStatus = await syncOrder(orderId)
    if (currentStatus !== 'ok') return currentStatus
    const isAvailable = order.canChangePaymentMethod === true &&
      order.availablePaymentMethodChanges.some((change) => change.provider === paymentProvider) &&
      order.paymentProvider !== paymentProvider
    if (!isAvailable) return 'not-allowed'

    try {
      await apiRequest('/orders/current/payment-method', {
        method: 'PUT',
        orderTrackingToken: order.orderTrackingToken,
        body: { paymentProvider }
      })
    } catch (error) {
      if (error.status === 404 || error.status === 401) {
        removeOrder(orderId)
        return 'unavailable'
      }
      if (error.status === 400 && error.code === 'invalid_payment_method_change') {
        const refreshStatus = await syncOrder(orderId)
        return refreshStatus === 'ok' ? 'invalid-request' : refreshStatus
      }
      if (error.status === 409 && [
        'payment_method_change_not_allowed',
        'payment_method_unchanged'
      ].includes(error.code)) {
        const refreshStatus = await syncOrder(orderId)
        if (refreshStatus !== 'ok') return refreshStatus
        return error.code === 'payment_method_unchanged' ? 'unchanged' : 'not-allowed'
      }
      if (error.status === 422 && error.code === 'payment_method_unavailable') {
        const refreshStatus = await syncOrder(orderId)
        return refreshStatus === 'ok' ? 'option-unavailable' : refreshStatus
      }
      const refreshStatus = await syncOrder(orderId)
      if (refreshStatus !== 'ok') return refreshStatus === 'error' ? 'unconfirmed' : refreshStatus
      if (order.paymentProvider === paymentProvider) return 'changed'
      return error.status ? 'rejected' : 'retryable'
    }

    const refreshStatus = await syncOrder(orderId)
    if (refreshStatus !== 'ok') return 'unconfirmed'
    return order.paymentProvider === paymentProvider ? 'changed' : 'unconfirmed'
  }

  const cancelOrder = async (orderId, reason = '') => {
    const order = orders.value.find((item) => item.orderId === orderId)
    if (!order) return 'unavailable'
    if (typeof reason !== 'string' || reason.length > 255) return 'invalid-reason'

    const currentStatus = await syncOrder(orderId)
    if (currentStatus !== 'ok') return currentStatus
    if (!isOrderCancellable(order)) return 'not-allowed'

    try {
      await apiRequest('/orders/current/cancellation', {
        method: 'POST',
        orderTrackingToken: order.orderTrackingToken,
        body: reason.trim() ? { reason: reason.trim() } : {}
      })
    } catch (error) {
      if (error.status === 404) {
        removeOrder(orderId)
        return 'unavailable'
      }
      if (error.status === 409 && error.code === 'customer_cancellation_not_allowed') {
        const refreshStatus = await syncOrder(orderId)
        return refreshStatus === 'error' ? 'error' : 'not-allowed'
      }
      return 'error'
    }

    const refreshedStatus = await syncOrder(orderId)
    if (refreshedStatus !== 'ok') return refreshedStatus === 'error' ? 'unconfirmed' : refreshedStatus
    return ['CANCELLED', 'CANCELED'].includes(String(order.orderStatus).toUpperCase())
      ? 'cancelled'
      : 'unconfirmed'
  }

  const submitTransferProof = async (orderId, file) => {
    const order = orders.value.find((item) => item.orderId === orderId)
    if (!order) throw new Error('No se encontro el pedido.')
    if (!file || !ACCEPTED_PROOF_TYPES.has(file.type) || file.size > MAX_PROOF_SIZE) {
      throw new Error('El comprobante debe ser JPEG, PNG o WebP y pesar hasta 5 MiB.')
    }

    const formData = new FormData()
    formData.append('file', file)
    uploadingProofs[orderId] = true
    transferErrors[orderId] = ''
    transferSuccess[orderId] = ''
    try {
      const proof = await apiRequest('/orders/current/transfer-proofs', {
        method: 'POST',
        orderTrackingToken: order.orderTrackingToken,
        formData
      })
      transferSuccess[orderId] = 'Comprobante enviado para revision.'
      return proof
    } catch (error) {
      transferErrors[orderId] = error.status === 409
        ? 'Este pedido no admite un comprobante en este momento.'
        : error.status === 422
          ? 'El archivo no es valido. Elige un JPEG, PNG o WebP de hasta 5 MiB.'
          : error.message || 'No se pudo enviar el comprobante.'
      throw error
    } finally {
      uploadingProofs[orderId] = false
    }
  }

  restoreOrders()

  return {
    addOrder,
    cancelOrder,
    changePaymentMethod,
    orderErrors,
    orders,
    syncOrder,
    removeOrder,
    restoreOrders,
    submitTransferProof,
    transferErrors,
    transferSuccess,
    uploadingProofs
  }
}