<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { requestStoreApi } from '../api/store.js'
import { useOrderTracking } from '../composables/useOrderTracking.js'
import { canUploadTransferProof } from '../utils/canUploadTransferProof.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { formatDeliveryAddress } from '../utils/formatDeliveryAddress.js'
import { formatOrderStatus } from '../utils/formatOrderStatus.js'
import { describePaymentProvider } from '../utils/paymentProviders.js'
import { formatQuantity as formatQuantityWithUnit } from '../utils/quantityRules.js'
import {
  buildInvoiceData,
  INVOICE_DOCUMENT_TYPES,
  isValidEmail,
  resolveInvoiceMode,
  validateInvoiceData
} from '../utils/invoiceData.js'
import { normalizeFulfillmentWindowId } from '../utils/normalizeFulfillmentWindowId.js'

const props = defineProps({
  items: { type: Array, required: true },
  cartToken: { type: String, default: '' },
  revision: { type: [String, Number], default: null },
  subtotal: { type: Number, required: true },
  discountAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  storeName: { type: String, required: true },
  saveOrder: { type: Function, required: true },
  orders: { type: Array, default: () => [] },
  trackedOrderId: { type: [String, Number], default: null },
  requestedOrderId: { type: String, default: '' },
  syncOrder: { type: Function, required: true },
  orderErrors: { type: Object, required: true },
  transferErrors: { type: Object, required: true },
  transferSuccess: { type: Object, required: true },
  uploadingProofs: { type: Object, required: true },
  submitTransferProof: { type: Function, required: true }
})

const emit = defineEmits(['back', 'complete'])

const trackingOnly = props.trackedOrderId !== null || Boolean(props.requestedOrderId)
const activeOrderId = ref(props.trackedOrderId)
const trackedOrder = computed(() => props.orders.find((order) => order.orderId === activeOrderId.value))
const { connection, finished: trackingFinished, loading: trackingLoading, unavailable: trackingUnavailable } = useOrderTracking({
  orderId: () => activeOrderId.value,
  orders: computed(() => props.orders),
  syncOrder: props.syncOrder
})
const connectionLabel = computed(() => ({
  connected: 'Actualización en tiempo real conectada',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…'
}[connection.value] ?? ''))
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
const touched = reactive({ email: false, legalName: false, documentNumber: false })
const showInvoiceBlock = computed(() =>
  invoiceMode.value === 'REQUIRED' || (invoiceMode.value === 'OPTIONAL' && wantsInvoice.value))
const invoiceErrors = computed(() => validateInvoiceData(invoice).errors)
const invoiceInvalid = computed(() => showInvoiceBlock.value && Object.keys(invoiceErrors.value).length > 0)
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
const savedOrder = ref(null)
const checkoutResult = ref(null)
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

const itemCount = computed(() => props.items.reduce((count, item) =>
  count + (item.productType === 'weight' ? 1 : item.quantity), 0
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
  checkoutOptions.value?.checkoutEnabled &&
  !emailError.value &&
  !invoiceInvalid.value &&
  enabledFulfillments.value.length > 0 &&
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
    form.fulfillmentType = firstFulfillment.type
    form.paymentProvider = firstFulfillment.paymentOptions.find((payment) => payment.enabled)?.provider ?? ''
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

const retrySaveOrder = () => {
  if (!savedOrder.value) return
  try {
    const record = props.saveOrder(savedOrder.value)
    orderSaveWarning.value = ''
    activeOrderId.value = record?.orderId ?? savedOrder.value.orderId
    if (!cartCleared.value) {
      cartCleared.value = true
      emit('complete', { cartToken: props.cartToken, result: checkoutResult.value })
    }
  } catch (error) {
    orderSaveWarning.value = error.message || 'No se pudo guardar el seguimiento en este navegador.'
  }
}

const confirmOrder = async () => {
  if (sending.value || props.items.length === 0 || !props.cartToken || !canSubmit.value) return

  sending.value = true
  checkoutError.value = ''
  try {
    const invoiceData = buildInvoiceData(invoiceMode.value, wantsInvoice.value, invoice)
    const result = await requestStoreApi('/carts/current/checkout', {
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
        revision: quote.value?.revision ?? props.revision,
        ...(invoiceData ? { invoiceData } : {})
      }
    })
    const order = result?.order ?? result?.data?.order ?? result
    checkoutResult.value = result
    savedOrder.value = order
    orderReference.value = order?.orderId ?? 'Pedido confirmado'
    completed.value = true
    clearInvoice()
    retrySaveOrder()
  } catch (error) {
    if (error.code === 'customer_invoice_data_required' || error.code === 'customer_invoice_data_disabled') {
      await loadInvoiceMode()
      checkoutError.value = error.code === 'customer_invoice_data_required'
        ? 'La tienda necesita tus datos de facturación para confirmar el pedido.'
        : 'La tienda ya no solicita datos de facturación. Volvé a confirmar el pedido.'
      Object.assign(touched, { legalName: true, documentNumber: true })
    } else {
      checkoutError.value = error.message || 'No se pudo confirmar el pedido.'
    }
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  if (trackingOnly) return
  void loadCheckoutOptions()
  void loadInvoiceMode()
})
</script>

<template>
  <div class="checkout-page">
    <header class="checkout-topbar">
      <Button class="back-link" label="Volver a la tienda" icon="pi pi-arrow-left" text :disabled="sending" @click="emit('back')" />
      <p class="checkout-store">{{ storeName }}</p>
    </header>

    <section v-if="completed || trackingOnly" class="order-complete" aria-live="polite">
      <template v-if="completed">
        <div class="success-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
        </div>
        <p class="checkout-eyebrow">Pedido confirmado</p>
        <h1>Gracias por tu compra</h1>
        <p>Registramos tu pedido número:</p>
        <strong class="order-reference">{{ orderReference }}</strong>
      </template>
      <template v-else>
        <p class="checkout-eyebrow">Seguimiento</p>
        <h1>Estado de tu pedido</h1>
      </template>
      <p v-if="savedOrder?.paymentProvider === 'TRANSFER' && savedOrder?.transferAlias">
        Transferí a <strong>{{ savedOrder.transferAlias }}</strong>
        <template v-if="savedOrder.transferAccountHolder">, a nombre de <strong>{{ savedOrder.transferAccountHolder }}</strong></template>.
      </p>
      <Message v-if="orderSaveWarning" severity="warn" :closable="false">
        {{ orderSaveWarning }}
        <Button label="Reintentar guardado" text @click="retrySaveOrder" />
      </Message>

      <nav v-if="orders.length > 1" class="tracked-orders" aria-label="Pedidos en seguimiento">
        <Button
          v-for="order in orders"
          :key="order.orderId"
          :label="`Pedido #${order.orderId}`"
          size="small"
          :severity="order.orderId === activeOrderId ? 'primary' : 'secondary'"
          :aria-pressed="order.orderId === activeOrderId"
          @click="activeOrderId = order.orderId"
        />
      </nav>

      <Message v-if="trackingFinished" severity="success" :closable="false" class="tracking-message">
        Tu pedido fue completado y ya no se muestra en el seguimiento.
      </Message>

      <Message v-else-if="trackingUnavailable || (!trackedOrder && !orderSaveWarning)" severity="info" :closable="false" class="tracking-message">
        El seguimiento sólo puede abrirse desde el dispositivo y navegador que creó el pedido. Si necesitás ayuda, contactá al comercio.
      </Message>

      <article v-else-if="trackedOrder" class="tracked-order">
        <div class="tracked-order-heading">
          <div>
            <p class="tracked-order-number">Pedido #{{ trackedOrder.orderId }}</p>
            <p class="tracked-order-date">{{ formatDate(trackedOrder.createdAt) }}</p>
          </div>
          <Tag :value="formatOrderStatus(trackedOrder.orderStatus)" />
        </div>
        <ProgressBar v-if="trackingLoading" mode="indeterminate" class="tracking-progress" />
        <p v-if="connectionLabel" class="tracking-connection" role="status">{{ connectionLabel }}</p>

        <dl class="tracked-order-details">
          <div>
            <dt>Modalidad</dt>
            <dd>{{ trackedOrder.fulfillmentType === 'PICKUP' ? 'Retiro en tienda' : 'Envío a domicilio' }}</dd>
          </div>
          <div>
            <dt>Entrega</dt>
            <dd>{{ formatDate(trackedOrder.scheduledDate) }}<template v-if="trackedOrder.scheduledStartsAt">, {{ trackedOrder.scheduledStartsAt }} a {{ trackedOrder.scheduledEndsAt }}</template></dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{{ formatMoney(trackedOrder.totalAmount, trackedOrder.currency) }}</dd>
          </div>
          <div>
            <dt>Pago</dt>
            <dd>{{ describePaymentProvider(trackedOrder.paymentProvider).label }}</dd>
          </div>
        </dl>

        <Message v-if="orderErrors[trackedOrder.orderId]" severity="error" :closable="false">
          {{ orderErrors[trackedOrder.orderId] }}
        </Message>

        <div v-if="canUploadTransferProof(trackedOrder)" class="proof-region">
          <p v-if="trackedOrder.transferAlias">
            Transferí a <strong>{{ trackedOrder.transferAlias }}</strong>
            <template v-if="trackedOrder.transferAccountHolder">, titular <strong>{{ trackedOrder.transferAccountHolder }}</strong></template>.
          </p>
          <label class="proof-input-label">
            <i class="pi pi-upload" aria-hidden="true"></i>
            <span>{{ uploadingProofs[trackedOrder.orderId] ? 'Enviando comprobante...' : 'Adjuntar comprobante' }}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="uploadingProofs[trackedOrder.orderId]"
              :aria-label="`Adjuntar comprobante para el pedido ${trackedOrder.orderId}`"
              @change="handleProof(trackedOrder, $event)"
            >
          </label>
          <Message v-if="transferSuccess[trackedOrder.orderId]" severity="success" :closable="false">
            {{ transferSuccess[trackedOrder.orderId] }}
          </Message>
          <Message v-if="transferErrors[trackedOrder.orderId]" severity="error" :closable="false">
            {{ transferErrors[trackedOrder.orderId] }}
          </Message>
          <small>JPEG, PNG o WebP, hasta 5 MiB.</small>
        </div>
      </article>
    </section>

    <template v-else>
      <div class="checkout-heading">
        <div>
          <p class="checkout-eyebrow">Casi listo</p>
          <h1>Finalizar compra</h1>
        </div>
        <span class="item-count">{{ itemCount }} {{ itemCount === 1 ? 'producto' : 'productos' }}</span>
      </div>

      <form class="checkout-layout" @submit.prevent="confirmOrder">
        <div class="checkout-fields">
          <Message v-if="optionsLoading" severity="info" :closable="false">Cargando opciones de compra...</Message>
          <Message v-else-if="optionsError" severity="error" :closable="false">
            {{ optionsError }}
            <Button label="Reintentar" icon="pi pi-refresh" text @click="loadCheckoutOptions" />
          </Message>

          <section class="checkout-section">
            <h2>Datos de contacto</h2>
            <div class="field-row">
              <label class="field">
                <span>Teléfono</span>
                <InputText v-model.trim="form.phone" name="phone" type="tel" autocomplete="tel" required />
              </label>
              <label class="field">
                <span>Email</span>
                <InputText
                  v-model.trim="form.email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  :invalid="touched.email && Boolean(emailError)"
                  :aria-invalid="touched.email && Boolean(emailError)"
                  aria-describedby="email-error"
                  @blur="touched.email = true"
                />
                <small v-if="touched.email && emailError" id="email-error" class="field-error">{{ emailError }}</small>
              </label>
            </div>
          </section>

          <section v-if="invoiceMode !== 'DISABLED'" class="checkout-section">
            <h2>{{ invoiceMode === 'REQUIRED' ? 'Datos necesarios para facturación' : '¿Necesitás factura?' }}</h2>
            <p class="invoice-help">
              {{ invoiceMode === 'REQUIRED'
                ? 'La tienda necesita estos datos para procesar el pedido.'
                : 'El comercio usará estos datos para emitirla.' }}
            </p>
            <label v-if="invoiceMode === 'OPTIONAL'" class="invoice-toggle">
              <input v-model="wantsInvoice" type="checkbox" name="wantsInvoice">
              <span>Necesito factura</span>
            </label>
            <template v-if="showInvoiceBlock">
              <label class="field">
                <span>Nombre completo o razón social</span>
                <InputText
                  v-model="invoice.legalName"
                  name="legalName"
                  maxlength="160"
                  autocomplete="name"
                  required
                  :invalid="touched.legalName && Boolean(invoiceErrors.legalName)"
                  :aria-invalid="touched.legalName && Boolean(invoiceErrors.legalName)"
                  aria-describedby="legal-name-error"
                  @blur="touched.legalName = true"
                />
                <small v-if="touched.legalName && invoiceErrors.legalName" id="legal-name-error" class="field-error">{{ invoiceErrors.legalName }}</small>
              </label>
              <div class="field-row">
                <label class="field">
                  <span>Tipo de documento</span>
                  <select v-model="invoice.documentType" name="documentType" required>
                    <option v-for="type in INVOICE_DOCUMENT_TYPES" :key="type" :value="type">{{ type }}</option>
                  </select>
                </label>
                <label class="field">
                  <span>Número de documento</span>
                  <InputText
                    v-model="invoice.documentNumber"
                    name="documentNumber"
                    inputmode="numeric"
                    autocomplete="off"
                    required
                    :invalid="touched.documentNumber && Boolean(invoiceErrors.documentNumber)"
                    :aria-invalid="touched.documentNumber && Boolean(invoiceErrors.documentNumber)"
                    aria-describedby="document-number-error"
                    @blur="touched.documentNumber = true"
                  />
                  <small v-if="touched.documentNumber && invoiceErrors.documentNumber" id="document-number-error" class="field-error">{{ invoiceErrors.documentNumber }}</small>
                </label>
              </div>
            </template>
          </section>

          <section class="checkout-section">
            <h2>Cómo recibir tu pedido</h2>
            <div class="choice-grid">
              <label
                v-for="option in enabledFulfillments"
                :key="option.type"
                class="choice-option"
                :class="{ selected: form.fulfillmentType === option.type }"
                :for="`fulfillment-${option.type}`"
              >
                <RadioButton
                  v-model="form.fulfillmentType"
                  :input-id="`fulfillment-${option.type}`"
                  name="fulfillment"
                  :value="option.type"
                />
                <span class="choice-copy">
                  <strong>{{ option.type === 'PICKUP' ? 'Retiro en tienda' : 'Envío a domicilio' }}</strong>
                  <small>{{ option.type === 'PICKUP' ? 'Retira tu pedido personalmente' : 'Recibe tu pedido en tu dirección' }}</small>
                </span>
              </label>
            </div>
            <div v-if="form.fulfillmentType === 'DELIVERY'" class="field-row address-fields">
              <label class="field">
                <span>Dirección</span>
                <InputText v-model.trim="form.address" name="address" autocomplete="street-address" required />
              </label>
              <label class="field">
                <span>Localidad</span>
                <InputText v-model.trim="form.locality" name="locality" autocomplete="address-level2" required />
              </label>
              <label class="field field-full">
                <span>Indicaciones para la entrega <small>Opcional</small></span>
                <Textarea v-model.trim="form.notes" name="notes" rows="2" auto-resize />
              </label>
            </div>
            <div class="field-row schedule-fields">
              <label class="field">
                <span>Fecha disponible</span>
                <select v-model="form.fulfillmentDate" name="fulfillmentDate" required :disabled="windowsLoading || !fulfillmentDays.length">
                  <option v-for="day in fulfillmentDays" :key="day.date" :value="day.date">
                    {{ new Date(`${day.date}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) }}
                  </option>
                </select>
              </label>
              <label class="field">
                <span>Horario</span>
                <select v-model="form.fulfillmentWindowId" name="fulfillmentWindowId" required :disabled="windowsLoading || !enabledWindows.length">
                  <option v-for="window in enabledWindows" :key="window.id" :value="String(window.id)">
                    {{ window.startsAt }} a {{ window.endsAt }}
                  </option>
                </select>
              </label>
            </div>
            <Message v-if="windowsLoading" severity="info" :closable="false">Buscando fechas y horarios...</Message>
            <Message v-else-if="windowsError" severity="warn" :closable="false">{{ windowsError }}</Message>
          </section>

          <section class="checkout-section">
            <h2>Forma de pago</h2>
            <div class="choice-grid payment-grid">
              <label
                v-for="payment in enabledPayments"
                :key="payment.provider"
                class="choice-option"
                :class="{ selected: form.paymentProvider === payment.provider }"
                :for="`payment-${payment.provider}`"
              >
                <RadioButton
                  v-model="form.paymentProvider"
                  :input-id="`payment-${payment.provider}`"
                  name="payment"
                  :value="payment.provider"
                />
                <span class="choice-copy">
                  <strong>{{ describePaymentProvider(payment.provider).label }}</strong>
                  <small>{{ describePaymentProvider(payment.provider).description }}</small>
                </span>
              </label>
            </div>
          </section>
        </div>

        <Card class="order-summary">
          <template #title>Resumen del pedido</template>
          <template #content>
          <ul class="summary-items">
            <li v-for="item in items" :key="item.id">
              <div class="summary-item-copy">
                <strong>{{ item.name }}</strong>
                <span>{{ formatQuantity(item) }}</span>
              </div>
              <strong>{{ formatMoney(item.pricePerType * item.quantity) }}</strong>
            </li>
          </ul>
          <div class="summary-totals">
            <div><span>Carrito</span><strong>{{ formatMoney(quote?.cartTotalAmount ?? totalAmount) }}</strong></div>
            <div v-if="form.fulfillmentType === 'DELIVERY'"><span>Envío</span><strong>{{ formatMoney(quote?.deliveryFee) }}</strong></div>
            <div v-else><span>Retiro en tienda</span><strong>{{ formatMoney(quote?.deliveryFee ?? 0) }}</strong></div>
            <div class="summary-total"><span>Total</span><strong>{{ formatMoney(quote?.totalAmount ?? totalAmount) }}</strong></div>
          </div>
          <p v-if="quoteLoading" class="delivery-note">Actualizando cotización...</p>
          <Message v-if="quoteError" severity="error" :closable="false" class="checkout-error">
            {{ quoteError }}
            <Button label="Reintentar" icon="pi pi-refresh" text @click="loadQuote(form.fulfillmentType)" />
          </Message>
          <Button
            class="submit-order"
            type="submit"
            :disabled="sending || items.length === 0 || !canSubmit"
            label="Confirmar pedido"
            :loading="sending"
            loading-icon="pi pi-spin pi-spinner"
            :aria-label="sending ? 'Enviando pedido' : 'Confirmar pedido'"
          />
          <Message v-if="checkoutError" severity="error" :closable="false" class="checkout-error">
            {{ checkoutError }}
          </Message>
          </template>
        </Card>
      </form>
    </template>
  </div>
</template>

<style scoped>
.checkout-page {
  width: min(90vw, 1200px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 1.25rem 0 3rem;
  color: #18251c;
}

.checkout-topbar,
.checkout-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.checkout-topbar {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(24, 37, 28, 0.12);
}

.back-link {
  --p-button-text-primary-color: var(--primary-color);
  --p-button-text-primary-hover-background: transparent;
  --p-button-text-primary-active-background: transparent;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0;
  border: 0;
  background: transparent;
  color: var(--primary-color);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

:deep(.p-button.back-link:not(:disabled):hover) {
  border: 0;
  background: transparent;
  color: var(--primary-color);
  box-shadow: none;
  transform: none;
}

.back-link svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.back-link:disabled {
  opacity: 0.55;
  cursor: wait;
}

.checkout-store {
  margin: 0;
  color: var(--primary-color);
  font-size: 0.9rem;
  font-weight: 700;
}

.checkout-heading {
  padding: 2rem 0 1.4rem;
  align-items: end;
}

.checkout-eyebrow {
  margin: 0 0 0.35rem;
  color: #66816b;
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
}

.checkout-heading .checkout-eyebrow {
  color: var(--primary-color);
}

.checkout-heading h1,
.order-complete h1 {
  margin: 0;
  font-size: 1.9rem;
  line-height: 1.2;
}

.item-count {
  color: var(--primary-color);
  font-size: 0.9rem;
  font-weight: 700;
}

.checkout-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  align-items: start;
  gap: clamp(1.5rem, 4vw, 3.5rem);
}

.checkout-fields {
  min-width: 0;
}

.checkout-section {
  padding: 1.35rem 0 1.5rem;
  border-top: 1px solid rgba(24, 37, 28, 0.12);
}

.checkout-section h2,
.order-summary h2 {
  margin: 0 0 1rem;
  font-size: 1.05rem;
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.4rem;
  color: #39483c;
  font-size: 0.87rem;
  font-weight: 700;
}

.field > span small {
  color: #7c897e;
  font-size: 0.76rem;
  font-weight: 500;
}

.field :deep(.p-inputtext),
.field :deep(.p-textarea) {
  width: 100%;
  min-height: 2.9rem;
  font-weight: 400;
}

.field > select {
  width: 100%;
  min-height: 2.9rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid #d2d8d3;
  border-radius: 6px;
  background: #fff;
  color: #18251c;
  font: inherit;
  font-weight: 400;
}

.field > select:focus-visible {
  outline: 3px solid var(--p-focus-ring-color);
  border-color: var(--p-primary-color);
}

.field :deep(.p-textarea) {
  min-height: 5rem;
  resize: vertical;
}

.field :deep(.p-inputtext:enabled:focus),
.field :deep(.p-textarea:enabled:focus) {
  border-color: var(--p-primary-color);
  box-shadow: 0 0 0 3px var(--p-focus-ring-color);
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.choice-option {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.9rem;
  border: 1px solid #d7ded8;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.choice-option.selected {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 7%, transparent);
}

.choice-option :deep(.p-radiobutton) {
  flex: 0 0 auto;
  margin-top: 0.13rem;
}

.choice-option :deep(.p-radiobutton-checked .p-radiobutton-box) {
  border-color: var(--primary-color);
  background: var(--primary-color);
}

.choice-option :deep(.p-radiobutton-box:focus-visible) {
  box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 24%, transparent);
}

.choice-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.2rem;
}

.choice-copy strong {
  font-size: 0.86rem;
}

.choice-copy small {
  color: #667369;
  font-size: 0.76rem;
  line-height: 1.4;
}

.address-fields {
  margin-top: 1rem;
}

.field-full {
  grid-column: 1 / -1;
}

.order-summary {
  position: sticky;
  top: 1rem;
}

.order-summary :deep(.p-card-body) {
  padding: 1.25rem;
}

.order-summary :deep(.p-card-title) {
  margin-bottom: 1rem;
  font-size: 1.05rem;
}

.summary-items {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-height: 17rem;
  overflow: auto;
  margin: 0;
  padding: 0 0 1rem;
  list-style: none;
  border-bottom: 1px solid rgba(24, 37, 28, 0.12);
}

.summary-items li,
.summary-totals > div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.84rem;
}

.summary-item-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.summary-item-copy strong {
  line-height: 1.35;
}

.summary-item-copy span,
.summary-totals span {
  color: #647167;
}

.summary-items li > strong {
  flex: 0 0 auto;
}

.summary-totals {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0 0;
}

.summary-total {
  margin-top: 0.25rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(24, 37, 28, 0.12);
  font-size: 1rem !important;
}

.summary-total strong {
  color: var(--primary-color);
  font-size: 1.1rem;
}

.delivery-note {
  margin: 1rem 0 0;
  color: var(--primary-color);
  font-size: 0.78rem;
  line-height: 1.5;
}

.submit-order {
  width: 100%;
  margin-top: 1.2rem;
}

.order-complete {
  display: flex;
  width: min(100%, 600px);
  min-height: 65vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  text-align: center;
}

.success-mark {
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  margin-bottom: 1.4rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
  color: var(--primary-color);
}

.success-mark svg {
  width: 2rem;
  height: 2rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

.order-complete > p:not(.checkout-eyebrow) {
  color: var(--primary-on-background-color);
  line-height: 1.6;
}

.order-complete .checkout-eyebrow,
.order-complete h1 {
  color: var(--primary-color);
}

.order-complete > p strong {
  color: var(--primary-color);
}

.order-reference {
  margin: 0.4rem 0 1.5rem;
  padding: 0.7rem 1rem;
  border-radius: 8px;
  background: var(--secondary-color);
  color: var(--secondary-contrast-color);
  font-size: 1.2rem;
  letter-spacing: 0.08em;
}

.field-error {
  color: #b42318;
  font-size: 0.82rem;
}

.invoice-help {
  margin: 0 0 0.75rem;
  color: #647167;
  font-size: 0.9rem;
}

.invoice-toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.75rem;
  margin-bottom: 0.5rem;
  font-weight: 700;
  cursor: pointer;
}

.invoice-toggle input {
  width: 1.2rem;
  height: 1.2rem;
  accent-color: var(--primary-color);
}

.tracked-orders {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin: 0.5rem 0 1rem;
}

.tracking-message {
  margin: 1rem 0;
}

.tracking-message.p-message-success {
  --p-message-success-background: var(--secondary-color);
  --p-message-success-border-color: var(--secondary-color);
  --p-message-success-color: var(--secondary-contrast-color);
  --p-message-text-color: var(--secondary-contrast-color);
}

.tracked-order {
  display: grid;
  width: 100%;
  gap: 1rem;
  margin: 1rem 0 1.5rem;
  padding: 1.25rem 0;
  border-top: 1px solid rgba(24, 37, 28, 0.14);
  border-bottom: 1px solid rgba(24, 37, 28, 0.14);
  text-align: left;
}

.tracked-order-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tracked-order-number,
.tracked-order-date,
.tracking-connection {
  margin: 0;
}

.tracked-order-number {
  font-weight: 800;
}

.tracked-order-date,
.tracking-connection,
.tracked-order-details dt,
.proof-region small {
  color: #647167;
  font-size: 0.82rem;
}

.tracking-progress {
  height: 0.35rem;
}

.tracked-order-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1.5rem;
  margin: 0;
}

.tracked-order-details dt,
.tracked-order-details dd {
  margin: 0;
}

.tracked-order-details dd {
  margin-top: 0.2rem;
  font-size: 0.9rem;
  font-weight: 700;
}

.proof-region {
  display: grid;
  justify-items: start;
  gap: 0.65rem;
}

.proof-region p {
  margin: 0;
  font-size: 0.9rem;
}

.proof-input-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.7rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  color: var(--primary-color);
  font-weight: 700;
  cursor: pointer;
}

.proof-input-label:focus-within {
  outline: 3px solid var(--p-focus-ring-color);
}

.proof-input-label input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

@media (max-width: 800px) {
  .checkout-layout {
    grid-template-columns: 1fr;
  }

  .order-summary {
    position: static;
  }
}

@media (max-width: 560px) {
  .checkout-page {
    width: min(92vw, 1200px);
  }

  .checkout-store {
    max-width: 45%;
    text-align: right;
  }

  .checkout-heading {
    align-items: flex-start;
  }

  .checkout-heading h1,
  .order-complete h1 {
    font-size: 1.55rem;
  }

  .field-row,
  .tracked-order-details,
  .choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
