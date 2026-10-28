import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { requestStoreApi } from '../api/store.js'
import { buildOrderTrackingPath, STORE_SLUG } from '../config/store.js'
import { useOrderTracking } from '../composables/useOrderTracking.js'
import { describePaymentProvider } from '../utils/paymentProviders.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { formatDeliveryAddress } from '../utils/formatDeliveryAddress.js'
import { formatQuantity as formatQuantityWithUnit } from '../utils/quantityRules.js'
import { buildInvoiceData, isValidEmail, resolveInvoiceMode, validateInvoiceData } from '../utils/invoiceData.js'
import { normalizeFulfillmentWindowId } from '../utils/normalizeFulfillmentWindowId.js'
import { isValidCustomerPhone } from '../utils/customerPhone.js'
import { isPendingMercadoPagoOrder, resolveMercadoPagoCheckoutUrl } from '../utils/mercadoPagoCheckout.js'
import { normalizeCheckoutOrder } from '../utils/normalizeCheckoutOrder.js'
import { rememberMercadoPagoReturnPublicOrderId } from '../utils/mercadoPagoReturn.js'
import { readOrderItems, snapshotOrderItems } from '../utils/orderItems.js'

export const useCheckoutPage = (props, emit) => {


  const trackingOnly = props.trackedOrderId !== null || Boolean(props.requestedPublicOrderId)
  const activeOrderId = ref(props.trackedOrderId ?? props.requestedPublicOrderId ?? null)
  const trackedOrder = computed(() => props.orders.find((order) =>
    String(order.orderId) === String(activeOrderId.value)))
  const trackedOrderItems = computed(() => readOrderItems(trackedOrder.value))
  const trackedOrderStatus = computed(() => String(trackedOrder.value?.orderStatus ?? '').trim().toUpperCase())
  const canDeleteTrackedOrder = computed(() =>
    !trackedOrder.value?.shared && ['CANCELLED', 'CANCELED'].includes(trackedOrderStatus.value))
  const canCancelTrackedOrder = computed(() =>
    trackedOrder.value?.canCancelOrder === true &&
    ['PENDING', 'PENDING_AVAILABILITY', 'PENDING_PAYMENT', 'AWAITING_PAYMENT',
      'AWAITING_PAYMENT_PROOF', 'PAYMENT_PROOF_UNDER_REVIEW', 'PAYMENT_UNDER_REVIEW',
      'UNDER_REVIEW', 'CONFIRMED'].includes(trackedOrderStatus.value))
  const paymentChangeOptions = computed(() =>
    (Array.isArray(trackedOrder.value?.availablePaymentMethodChanges)
      ? trackedOrder.value.availablePaymentMethodChanges
      : []).filter((option) =>
      ['CASH', 'TRANSFER', 'MERCADO_PAGO'].includes(option?.provider) &&
      typeof option.label === 'string' &&
      option.provider !== trackedOrder.value?.paymentProvider &&
      !blockedPaymentProviders.value.has(option.provider)))
  const canChangeTrackedPaymentMethod = computed(() =>
    trackedOrder.value?.canChangePaymentMethod === true &&
    paymentChangeOptions.value.length > 0)
  const confirmingOrderDeletion = ref(false)
  const deletedOrderId = ref(null)
  const confirmingOrderCancellation = ref(false)
  const cancellingOrder = ref(false)
  const cancellationReason = ref('')
  const cancellationMessage = ref('')
  const cancellationMessageSeverity = ref('error')
  const paymentChangeDialogVisible = ref(false)
  const selectedPaymentProvider = ref('')
  const changingPaymentMethod = ref(false)
  const paymentChangeMessage = ref('')
  const paymentChangeMessageSeverity = ref('error')
  const blockedPaymentProviders = ref(new Set())
  const trackingLinkCopied = ref(false)
  const trackingLinkError = ref('')
  let trackingLinkResetTimer = null
  const trackingLink = computed(() => {
    if (
      !trackedOrder.value?.publicOrderId ||
      !trackedOrder.value?.orderTrackingToken ||
      typeof window === 'undefined'
    ) return ''
    const url = new URL(window.location.href)
    url.pathname = buildOrderTrackingPath(trackedOrder.value.publicOrderId, STORE_SLUG)
    url.search = ''
    url.hash = new URLSearchParams({
      trackingToken: trackedOrder.value.orderTrackingToken
    }).toString()
    return url.toString()
  })
  const copyTrackingLink = async () => {
    if (!trackingLink.value) return
    trackingLinkError.value = ''
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }
      await navigator.clipboard.writeText(trackingLink.value)
      trackingLinkCopied.value = true
      if (trackingLinkResetTimer) window.clearTimeout(trackingLinkResetTimer)
      trackingLinkResetTimer = window.setTimeout(() => {
        trackingLinkCopied.value = false
        trackingLinkResetTimer = null
      }, 1000)
    } catch {
      trackingLinkError.value = 'No se pudo copiar el enlace. Revisá los permisos del navegador e intentá nuevamente.'
    }
  }
  const retrySharedOrderLoad = async () => {
    const result = await props.loadOrderByPublicId(props.requestedPublicOrderId)
    if (result !== 'ok') return
    const order = props.orders.find((item) =>
      item.publicOrderId === props.requestedPublicOrderId)
    if (!order) return
    activeOrderId.value = null
    await nextTick()
    activeOrderId.value = order.orderId
  }
  watch(() => trackedOrder.value?.orderStatus, () => {
    if (!canDeleteTrackedOrder.value) confirmingOrderDeletion.value = false
  })
  watch(() => trackedOrder.value?.canCancelOrder, (canCancel) => {
    if (!canCancel) confirmingOrderCancellation.value = false
  })
  watch(canCancelTrackedOrder, (canCancel) => {
    if (!canCancel) confirmingOrderCancellation.value = false
  })
  const { connection, finished: trackingFinished, unavailable: trackingUnavailable } = useOrderTracking({
    orderId: () => activeOrderId.value,
    orders: computed(() => props.orders),
    syncOrder: props.syncOrder
  })
  onBeforeUnmount(() => {
    if (trackingLinkResetTimer) window.clearTimeout(trackingLinkResetTimer)
  })
  const connectionLabel = computed(() => ({
    connected: 'Actualización en tiempo real conectada',
    connecting: 'Conectando…',
    reconnecting: 'Reconectando…'
  }[connection.value] ?? ''))
  const deleteTrackedOrder = () => {
    if (!confirmingOrderDeletion.value || !canDeleteTrackedOrder.value) return

    const orderId = trackedOrder.value.orderId
    const nextOrder = props.orders.find((order) => order.orderId !== orderId)
    props.removeOrder(orderId)
    confirmingOrderDeletion.value = false

    if (nextOrder) {
      activeOrderId.value = nextOrder.orderId
      return
    }

    deletedOrderId.value = orderId
    activeOrderId.value = null
  }
  const selectTrackedOrder = (order) => {
    activeOrderId.value = order.orderId
    confirmingOrderDeletion.value = false
    confirmingOrderCancellation.value = false
    cancellationReason.value = ''
    cancellationMessage.value = ''
    blockedPaymentProviders.value = new Set()
  }
  const cancelTrackedOrder = async () => {
    if (!confirmingOrderCancellation.value || !canCancelTrackedOrder.value || cancellingOrder.value) return

    cancellingOrder.value = true
    cancellationMessage.value = ''
    try {
      const result = await props.cancelOrder(trackedOrder.value.orderId, cancellationReason.value)
      const messages = {
        cancelled: ['success', 'El pedido se canceló correctamente.'],
        'not-allowed': ['error', 'Este pedido ya no se puede cancelar online.'],
        unavailable: ['error', 'No encontramos este pedido. Se quitó el acceso guardado en este navegador.'],
        error: ['error', 'No se pudo cancelar el pedido. Revisá tu conexión e intentá nuevamente.'],
        unconfirmed: ['warn', 'Se envió la solicitud, pero no pudimos actualizar el estado. Volvé a intentar; la cancelación es segura para reintentar.'],
        'invalid-reason': ['error', 'El motivo no puede superar los 255 caracteres.']
      }
      const [severity, message] = messages[result] ?? messages.error
      cancellationMessageSeverity.value = severity
      cancellationMessage.value = message
      if (result === 'cancelled') cancellationReason.value = ''
      if (result === 'cancelled' || result === 'not-allowed' || result === 'unavailable') {
        confirmingOrderCancellation.value = false
      }
    } catch {
      cancellationMessageSeverity.value = 'error'
      cancellationMessage.value = 'No se pudo cancelar el pedido. Revisá tu conexión e intentá nuevamente.'
    } finally {
      cancellingOrder.value = false
    }
  }
  const openPaymentChangeDialog = () => {
    if (!canChangeTrackedPaymentMethod.value) return
    selectedPaymentProvider.value = paymentChangeOptions.value[0].provider
    paymentChangeMessage.value = ''
    paymentChangeDialogVisible.value = true
  }
  const changeTrackedPaymentMethod = async () => {
    if (
      changingPaymentMethod.value ||
      !canChangeTrackedPaymentMethod.value ||
      !paymentChangeOptions.value.some((option) => option.provider === selectedPaymentProvider.value)
    ) return

    changingPaymentMethod.value = true
    paymentChangeMessage.value = ''
    try {
      const result = await props.changePaymentMethod(trackedOrder.value.orderId, selectedPaymentProvider.value)
      if (result === 'changed') {
        if (trackedOrder.value.paymentProvider === 'MERCADO_PAGO') {
          if (trackedOrderStatus.value === 'PENDING_AVAILABILITY') {
            paymentChangeMessageSeverity.value = 'success'
            paymentChangeMessage.value = 'El medio de pago se actualizó. La tienda debe confirmar la disponibilidad antes de iniciar el pago online.'
            paymentChangeDialogVisible.value = false
            return
          }

          try {
            const paymentUrl = resolveMercadoPagoCheckoutUrl(trackedOrder.value.mercadoPagoCheckoutUrl)
            if (!paymentUrl) {
              paymentChangeMessageSeverity.value = 'error'
              paymentChangeMessage.value = 'El pedido quedó pendiente de pago, pero no recibimos un enlace nuevo de Mercado Pago. No vuelvas a confirmar el pago; elegí otra alternativa disponible o contactá a la tienda.'
              paymentChangeDialogVisible.value = false
              return
            }
            window.location.assign(paymentUrl)
            return
          } catch {
            paymentChangeMessageSeverity.value = 'error'
            paymentChangeMessage.value = 'El pedido quedó pendiente de pago, pero no pudimos validar el enlace nuevo de Mercado Pago. No vuelvas a confirmar el pago; elegí otra alternativa disponible o contactá a la tienda.'
            paymentChangeDialogVisible.value = false
            return
          }
        }

        paymentChangeMessageSeverity.value = 'success'
        paymentChangeMessage.value = `El medio de pago cambió a ${describePaymentProvider(trackedOrder.value.paymentProvider).label}.`
        paymentChangeDialogVisible.value = false
        selectedPaymentProvider.value = ''
        return
      }

      const messages = {
        'invalid-request': 'La API rechazó esta alternativa. Actualizamos el pedido; elegí otra opción disponible o contactá a la tienda.',
        'not-allowed': 'El pedido ya no admite cambios de medio de pago. Actualizamos su estado.',
        'option-unavailable': 'Esa alternativa ya no está disponible. Actualizamos las opciones de pago.',
        unchanged: 'El pedido ya usa ese medio de pago. Actualizamos su estado.',
        unavailable: 'No pudimos recuperar el pedido. Se quitó el acceso guardado en este navegador.',
        unconfirmed: 'El cambio se envió, pero no pudimos actualizar el estado. Revisá el seguimiento; no repitas el cambio hasta confirmar el medio vigente.',
        rejected: 'La API no aceptó el cambio de medio de pago. El pedido sigue con el medio indicado en el seguimiento.',
        retryable: 'No pudimos confirmar el cambio. El pedido sigue con el medio indicado en el seguimiento; podés volver a intentarlo.',
        error: 'No se pudo actualizar el pedido. Revisá el seguimiento antes de volver a intentarlo.',
        'invalid-option': 'Esa alternativa no está disponible para este pedido.'
      }
      if (result === 'invalid-request') {
        blockedPaymentProviders.value = new Set([
          ...blockedPaymentProviders.value,
          selectedPaymentProvider.value
        ])
      }
      paymentChangeMessageSeverity.value = ['option-unavailable', 'retryable'].includes(result) ? 'warn' : 'error'
      paymentChangeMessage.value = messages[result] ?? messages.error
      selectedPaymentProvider.value = ''
      if (['invalid-request', 'not-allowed', 'unchanged', 'unavailable'].includes(result)) {
        paymentChangeDialogVisible.value = false
      }
    } catch {
      paymentChangeMessageSeverity.value = 'error'
      paymentChangeMessage.value = 'No se pudo actualizar el pedido. Revisá el seguimiento antes de volver a intentarlo.'
    } finally {
      changingPaymentMethod.value = false
    }
  }
  const formatDate = (value) => value
    ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    : 'Fecha no disponible'
  const handleProof = async (order, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      await props.submitTransferProof(order.orderId, file)
    } catch {
      // The composable exposes the actionable error beside this order.
    }
  }

  const form = reactive({
    phone: '',
    email: '',
    fulfillmentType: '',
    fulfillmentDate: '',
    fulfillmentWindowId: '',
    address: '',
    locality: '',
    notes: '',
    paymentProvider: ''
  })
  const invoiceMode = ref('DISABLED')
  const wantsInvoice = ref(false)
  const invoice = reactive({ legalName: '', documentType: 'DNI', documentNumber: '' })
  const touched = reactive({ phone: false, email: false, legalName: false, documentNumber: false })
  const showInvoiceBlock = computed(() =>
    invoiceMode.value === 'REQUIRED' || (invoiceMode.value === 'OPTIONAL' && wantsInvoice.value))
  const invoiceErrors = computed(() => validateInvoiceData(invoice).errors)
  const invoiceInvalid = computed(() => showInvoiceBlock.value && Object.keys(invoiceErrors.value).length > 0)
  const phoneError = computed(() => isValidCustomerPhone(form.phone)
    ? ''
    : 'Ingresá un teléfono válido con código de país o área.')
  const emailError = computed(() => isValidEmail(form.email) ? '' : 'Ingresá un email válido.')

  const loadInvoiceMode = async () => {
    try {
      invoiceMode.value = resolveInvoiceMode(await requestStoreApi('/settings'))
    } catch {
      // Keep the last known mode; the API validates the current rule on checkout.
    }
    if (invoiceMode.value === 'DISABLED') clearInvoice()
  }

  function clearInvoice() {
    wantsInvoice.value = false
    Object.assign(invoice, { legalName: '', documentType: 'DNI', documentNumber: '' })
    Object.assign(touched, { legalName: false, documentNumber: false })
  }

  watch(wantsInvoice, (wanted) => {
    if (!wanted) clearInvoice()
  })
  const sending = ref(false)
  const completed = ref(false)
  const checkoutBlocked = ref(false)
  const checkoutOutcomeUnknown = ref(false)
  const savedOrder = ref(null)
  const checkoutResult = ref(null)
  const mercadoPagoCheckoutUrl = ref('')
  const paymentLinkError = ref('')
  let paymentRedirectStarted = false
  const cartCleared = ref(false)
  const orderSaveWarning = ref('')
  const orderReference = ref('')
  const checkoutError = ref('')
  const optionsLoading = ref(true)
  const optionsError = ref('')
  const checkoutOptions = ref(null)
  const windowsLoading = ref(false)
  const windowsError = ref('')
  const fulfillmentDays = ref([])
  const quoteLoading = ref(false)
  const quoteError = ref('')
  const quote = ref(null)
  const pendingMercadoPagoPayment = computed(() => isPendingMercadoPagoOrder(
    savedOrder.value ?? trackedOrder.value
  ))
  const confirmedMercadoPagoPayment = computed(() => {
    const order = savedOrder.value ?? trackedOrder.value
    return order?.paymentProvider === 'MERCADO_PAGO' &&
      order?.orderStatus === 'CONFIRMED'
  })

  const itemCount = computed(() => props.items.reduce((count, item) =>
    count + (item.quantityType === 'weight' || item.decimalScale > 0 ? 1 : item.quantity), 0
  , 0))

  const enabledFulfillments = computed(() => (checkoutOptions.value?.fulfillmentOptions ?? [])
    .filter((option) => option.enabled && option.paymentOptions?.some((payment) => payment.enabled)))
  const selectedFulfillment = computed(() => enabledFulfillments.value
    .find((option) => option.type === form.fulfillmentType))
  const enabledPayments = computed(() => (selectedFulfillment.value?.paymentOptions ?? [])
    .filter((payment) => payment.enabled))
  const selectedDay = computed(() => fulfillmentDays.value
    .find((day) => day.date === form.fulfillmentDate))
  const enabledWindows = computed(() => selectedDay.value?.windows ?? [])
  const selectedWindow = computed(() => enabledWindows.value
    .find((window) => String(window.id) === String(form.fulfillmentWindowId)))
  const canSubmit = computed(() =>
    !optionsLoading.value &&
    !optionsError.value &&
    !checkoutBlocked.value &&
    !checkoutOutcomeUnknown.value &&
    checkoutOptions.value?.checkoutEnabled &&
    !phoneError.value &&
    !emailError.value &&
    !invoiceInvalid.value &&
    enabledFulfillments.value.length > 0 &&
    (form.fulfillmentType !== 'DELIVERY' || Boolean(form.address.trim() && form.locality.trim())) &&
    Boolean(form.paymentProvider) &&
    Boolean(form.fulfillmentDate) &&
    Boolean(form.fulfillmentWindowId) &&
    Boolean(quote.value) &&
    !windowsLoading.value &&
    !quoteLoading.value
  )

  const formatQuantity = (item) => formatQuantityWithUnit(item.quantity, item)

  const formatMoney = (amount, currency = quote.value?.currency || props.currency || 'ARS') =>
    formatCurrency(Number(amount ?? 0), currency)

  const effectiveDiscount = computed(() => {
    const quoted = Number(quote.value?.discountAmount)
    return Number.isFinite(quoted) && quote.value?.discountAmount != null ? quoted : props.discountAmount
  })

  const unwrapPayload = (payload, key) => payload?.[key] ?? payload?.data?.[key] ?? payload?.data ?? payload

  const today = () => {
    const date = new Date()
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return localDate.toISOString().slice(0, 10)
  }

  const loadCheckoutOptions = async () => {
    optionsLoading.value = true
    optionsError.value = ''
    try {
      const payload = unwrapPayload(await requestStoreApi('/carts/current/checkout-options', {
        cartToken: props.cartToken
      }), 'options')
      checkoutOptions.value = payload
      const firstFulfillment = enabledFulfillments.value.find((option) => option.type === 'PICKUP') ??
        enabledFulfillments.value[0]
      if (!payload?.checkoutEnabled || !firstFulfillment) {
        optionsError.value = 'La tienda no esta aceptando pedidos por el momento.'
        return
      }
      const selectedFulfillment = enabledFulfillments.value.find((option) =>
        option.type === form.fulfillmentType
      ) ?? firstFulfillment
      form.fulfillmentType = selectedFulfillment.type
      form.paymentProvider = selectedFulfillment.paymentOptions
        .find((payment) => payment.enabled && payment.provider === form.paymentProvider)?.provider ??
        selectedFulfillment.paymentOptions.find((payment) => payment.enabled)?.provider ?? ''
    } catch (error) {
      optionsError.value = error.message || 'No se pudieron cargar las opciones de compra.'
    } finally {
      optionsLoading.value = false
    }
  }

  const loadFulfillmentWindows = async (fulfillmentType) => {
    windowsLoading.value = true
    windowsError.value = ''
    fulfillmentDays.value = []
    form.fulfillmentDate = ''
    form.fulfillmentWindowId = ''
    try {
      const payload = unwrapPayload(await requestStoreApi('/carts/current/fulfillment-windows', {
        cartToken: props.cartToken,
        query: { fulfillmentType, from: today(), days: 14 }
      }), 'fulfillmentWindows')
      fulfillmentDays.value = Array.isArray(payload?.days) ? payload.days : []
      const firstDay = fulfillmentDays.value.find((day) => day.windows?.length)
      if (!firstDay) {
        windowsError.value = 'No hay fechas y horarios disponibles para esta modalidad.'
        return
      }
      form.fulfillmentDate = firstDay.date
      form.fulfillmentWindowId = String(firstDay.windows[0].id)
    } catch (error) {
      windowsError.value = error.status === 422
        ? 'Esta modalidad ya no esta disponible. Selecciona otra opcion.'
        : error.message || 'No se pudieron cargar las fechas disponibles.'
    } finally {
      windowsLoading.value = false
    }
  }

  const loadQuote = async (fulfillmentType) => {
    quoteLoading.value = true
    quoteError.value = ''
    quote.value = null
    try {
      quote.value = unwrapPayload(await requestStoreApi('/carts/current/quote', {
        method: 'POST',
        cartToken: props.cartToken,
        body: { fulfillmentType }
      }), 'quote')
    } catch (error) {
      quoteError.value = error.message || 'No se pudo calcular el total del pedido.'
    } finally {
      quoteLoading.value = false
    }
  }

  watch(() => form.fulfillmentType, (fulfillmentType) => {
    if (!fulfillmentType) return
    const firstPayment = enabledFulfillments.value
      .find((option) => option.type === fulfillmentType)?.paymentOptions
      ?.find((payment) => payment.enabled)
    if (!enabledPayments.value.some((payment) => payment.provider === form.paymentProvider)) {
      form.paymentProvider = firstPayment?.provider ?? ''
    }
    void loadFulfillmentWindows(fulfillmentType)
    void loadQuote(fulfillmentType)
  })

  watch(() => form.fulfillmentDate, (date) => {
    const firstWindow = fulfillmentDays.value.find((day) => day.date === date)?.windows?.[0]
    form.fulfillmentWindowId = firstWindow ? String(firstWindow.id) : ''
  })

  const redirectToMercadoPago = () => {
    if (!mercadoPagoCheckoutUrl.value || paymentRedirectStarted) return
    paymentRedirectStarted = true
    rememberMercadoPagoReturnPublicOrderId(STORE_SLUG, savedOrder.value?.publicOrderId)
    window.location.assign(mercadoPagoCheckoutUrl.value)
  }

  const retrySaveOrder = () => {
    if (!savedOrder.value) return false
    try {
      const record = props.saveOrder(savedOrder.value)
      orderSaveWarning.value = ''
      activeOrderId.value = record?.orderId ?? savedOrder.value.orderId
      if (!cartCleared.value) {
        cartCleared.value = true
        emit('complete', { cartToken: props.cartToken, result: checkoutResult.value })
      }
      if (pendingMercadoPagoPayment.value && mercadoPagoCheckoutUrl.value) redirectToMercadoPago()
      return true
    } catch (error) {
      orderSaveWarning.value = error.message || 'No se pudo guardar el seguimiento en este navegador.'
      return false
    }
  }

  const refreshCheckoutContext = async ({ refreshCart = false } = {}) => {
    const previousFulfillmentType = form.fulfillmentType
    if (refreshCart) await props.refreshCart()
    await loadCheckoutOptions()
    if (form.fulfillmentType && form.fulfillmentType === previousFulfillmentType) {
      await Promise.all([
        loadFulfillmentWindows(form.fulfillmentType),
        loadQuote(form.fulfillmentType)
      ])
    }
  }

  const handleCheckoutError = async (error) => {
    if (error.code === 'customer_invoice_data_required' || error.code === 'customer_invoice_data_disabled') {
      await loadInvoiceMode()
      checkoutError.value = error.code === 'customer_invoice_data_required'
        ? 'La tienda necesita tus datos de facturación para confirmar el pedido.'
        : 'La tienda ya no solicita datos de facturación. Volvé a confirmar el pedido.'
      Object.assign(touched, { legalName: true, documentNumber: true })
      return
    }

    if (error.status === 401) {
      checkoutBlocked.value = true
      checkoutError.value = 'El carrito ya no está disponible. Volvé a la tienda para iniciar una nueva compra.'
      return
    }

    if (error.status === 404) {
      checkoutBlocked.value = true
      checkoutOutcomeUnknown.value = true
      checkoutError.value = 'No pudimos encontrar el carrito y no es seguro volver a enviar este checkout. Consultá el seguimiento o contactá a la tienda antes de intentar pagar otra vez.'
      return
    }

    const errorCode = String(error.code ?? '').toLowerCase()
    if (error.status === 409 || errorCode === 'cart_revision_conflict') {
      try {
        await refreshCheckoutContext({ refreshCart: true })
        checkoutError.value = 'El carrito cambió. Revisá las opciones y el total actualizados antes de confirmar nuevamente.'
      } catch {
        checkoutError.value = 'El carrito cambió, pero no pudimos actualizarlo. Volvé a cargar la tienda antes de confirmar.'
      }
      return
    }

    if (error.status === 422 && errorCode.includes('fulfillment_window_full')) {
      await loadFulfillmentWindows(form.fulfillmentType)
      checkoutError.value = 'Ese horario ya no está disponible. Elegí otra fecha u horario.'
      return
    }

    if (error.status === 422 && (
      errorCode.includes('invalid_cart') ||
      errorCode.includes('invalid_product_quantity')
    )) {
      try {
        await refreshCheckoutContext({ refreshCart: true })
        checkoutError.value = 'El carrito necesita una actualización. Revisá los productos y volvé a confirmar.'
      } catch {
        checkoutError.value = 'No pudimos actualizar el carrito. Volvé a cargar la tienda antes de confirmar.'
      }
      return
    }

    if (error.status === 422 && (
      errorCode.includes('payment') ||
      errorCode.includes('provider')
    )) {
      await loadCheckoutOptions()
      checkoutError.value = 'Las formas de pago disponibles cambiaron. Revisá la opción seleccionada antes de confirmar.'
      return
    }

    if (!error.status || error.status >= 500) {
      checkoutBlocked.value = true
      checkoutOutcomeUnknown.value = true
      checkoutError.value = 'No pudimos confirmar si el pedido se creó. Para evitar un pedido duplicado, no vuelvas a enviar el pago; revisá el seguimiento o contactá a la tienda.'
      return
    }

    checkoutError.value = error.message || 'No se pudo confirmar el pedido.'
  }

  const confirmOrder = async () => {
    if (sending.value || props.items.length === 0 || !props.cartToken || !canSubmit.value) return

    sending.value = true
    checkoutError.value = ''
    let result
    try {
      const invoiceData = buildInvoiceData(invoiceMode.value, wantsInvoice.value, invoice)
      result = await requestStoreApi('/carts/current/checkout', {
        method: 'POST',
        cartToken: props.cartToken,
        body: {
          customerEmail: form.email,
          customerPhone: form.phone,
          fulfillmentType: form.fulfillmentType,
          addressSnapshot: form.fulfillmentType === 'DELIVERY'
            ? formatDeliveryAddress(form)
            : null,
          fulfillmentDate: form.fulfillmentDate,
          fulfillmentWindowId: normalizeFulfillmentWindowId(form.fulfillmentWindowId),
          paymentProvider: form.paymentProvider,
          revision: checkoutOptions.value?.revision ?? quote.value?.revision ?? props.revision,
          ...(invoiceData ? { invoiceData } : {})
        }
      })
    } catch (error) {
      sending.value = false
      await handleCheckoutError(error)
      return
    }

    const { order: responseOrder, mercadoPagoCheckoutUrl: checkoutPaymentUrl } = normalizeCheckoutOrder(result)
    const responseItems = readOrderItems(responseOrder)
    const order = {
      ...responseOrder,
      items: responseItems.length ? responseItems : snapshotOrderItems(props.items)
    }
    checkoutResult.value = result
    savedOrder.value = order
    orderReference.value = order?.orderId ?? 'Pedido registrado'
    completed.value = true
    clearInvoice()

    if (order?.paymentProvider === 'MERCADO_PAGO') {
      if (!pendingMercadoPagoPayment.value) {
        paymentLinkError.value = confirmedMercadoPagoPayment.value
          ? ''
          : 'El pedido se registró, pero la API no informó un estado de pago pendiente. Revisá el seguimiento antes de volver a pagar.'
      } else {
        try {
          const paymentUrl = resolveMercadoPagoCheckoutUrl(
            checkoutPaymentUrl
          )
          if (!paymentUrl) {
            paymentLinkError.value = 'El pedido quedó pendiente de pago, pero la API no devolvió el enlace de Mercado Pago. No vuelvas a confirmar el checkout; consultá el seguimiento o contactá a la tienda.'
          } else {
            mercadoPagoCheckoutUrl.value = paymentUrl
          }
        } catch {
          paymentLinkError.value = 'El pedido quedó pendiente de pago, pero no pudimos validar su enlace de Mercado Pago. No vuelvas a confirmar el checkout; contactá a la tienda.'
        }
      }
    }

    retrySaveOrder()
    sending.value = false
  }

  onMounted(() => {
    if (trackingOnly) return
    void loadCheckoutOptions()
    void loadInvoiceMode()
  })

  return {
    trackingOnly,
    activeOrderId,
    trackedOrder,
    trackedOrderItems,
    canDeleteTrackedOrder,
    canCancelTrackedOrder,
    paymentChangeOptions,
    canChangeTrackedPaymentMethod,
    confirmingOrderDeletion,
    deletedOrderId,
    confirmingOrderCancellation,
    cancellingOrder,
    cancellationReason,
    cancellationMessage,
    cancellationMessageSeverity,
    paymentChangeDialogVisible,
    selectedPaymentProvider,
    changingPaymentMethod,
    paymentChangeMessage,
    paymentChangeMessageSeverity,
    trackingLinkCopied,
    trackingLinkError,
    copyTrackingLink,
    retrySharedOrderLoad,
    connection,
    trackingFinished,
    trackingUnavailable,
    connectionLabel,
    deleteTrackedOrder,
    selectTrackedOrder,
    cancelTrackedOrder,
    openPaymentChangeDialog,
    changeTrackedPaymentMethod,
    formatDate,
    handleProof,
    form,
    invoiceMode,
    wantsInvoice,
    invoice,
    touched,
    showInvoiceBlock,
    invoiceErrors,
    phoneError,
    emailError,
    sending,
    completed,
    checkoutOutcomeUnknown,
    savedOrder,
    paymentLinkError,
    orderSaveWarning,
    orderReference,
    checkoutError,
    optionsLoading,
    optionsError,
    windowsLoading,
    windowsError,
    fulfillmentDays,
    quoteLoading,
    quoteError,
    quote,
    pendingMercadoPagoPayment,
    confirmedMercadoPagoPayment,
    itemCount,
    enabledFulfillments,
    enabledPayments,
    enabledWindows,
    canSubmit,
    formatQuantity,
    formatMoney,
    effectiveDiscount,
    loadCheckoutOptions,
    loadQuote,
    retrySaveOrder,
    confirmOrder,
  }
}
