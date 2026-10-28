<script setup>
import { canUploadTransferProof } from '../utils/canUploadTransferProof.js'
import { formatOrderStatus } from '../utils/formatOrderStatus.js'
import { getStatusTone } from '../utils/orderStatusStyles.js'
import OrderStatusTimeline from './OrderStatusTimeline.vue'
import { describePaymentProvider } from '../utils/paymentProviders.js'
import { formatQuantity as formatQuantityWithUnit } from '../utils/quantityRules.js'
import { INVOICE_DOCUMENT_TYPES } from '../utils/invoiceData.js'
import { useCheckoutPage } from '../composables/useCheckoutPage.js'

const props = defineProps({
  items: { type: Array, required: true },
  cartToken: { type: String, default: '' },
  revision: { type: [String, Number], default: null },
  subtotal: { type: Number, required: true },
  discountAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  storeName: { type: String, required: true },
  supportContact: { type: Object, default: null },
  saveOrder: { type: Function, required: true },
  refreshCart: { type: Function, required: true },
  orders: { type: Array, default: () => [] },
  trackedOrderId: { type: [String, Number], default: null },
  requestedPublicOrderId: { type: String, default: '' },
  loadOrderByPublicId: { type: Function, default: async () => 'unavailable' },
  cancelOrder: { type: Function, required: true },
  changePaymentMethod: { type: Function, required: true },
  removeOrder: { type: Function, required: true },
  syncOrder: { type: Function, required: true },
  orderErrors: { type: Object, required: true },
  transferErrors: { type: Object, required: true },
  transferSuccess: { type: Object, required: true },
  uploadingProofs: { type: Object, required: true },
  submitTransferProof: { type: Function, required: true }
})

const emit = defineEmits(['back', 'complete'])


const {
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
} = useCheckoutPage(props, emit)
</script>

<template>
  <div class="checkout-page">
    <header class="checkout-topbar">
      <Button class="back-link" label="Volver a la tienda" icon="pi pi-arrow-left" text :disabled="sending" @click="emit('back')" />
      <p class="checkout-store">{{ storeName }}</p>
    </header>

    <section v-if="completed || trackingOnly" class="order-complete" aria-live="polite">
      <template v-if="completed">
        <div v-if="!pendingMercadoPagoPayment" class="success-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
        </div>
        <p class="checkout-eyebrow">
          {{ pendingMercadoPagoPayment
            ? 'Pago pendiente'
            : savedOrder?.paymentProvider === 'MERCADO_PAGO'
              ? confirmedMercadoPagoPayment ? 'Pago confirmado' : 'Pedido registrado'
              : 'Pedido confirmado' }}
        </p>
        <h1>
          {{ pendingMercadoPagoPayment
            ? 'Esperando la confirmación del pago'
            : savedOrder?.paymentProvider === 'MERCADO_PAGO' && !confirmedMercadoPagoPayment
              ? 'Estamos verificando tu pago'
              : 'Gracias por tu compra' }}
        </h1>
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
      <Message v-if="completed && pendingMercadoPagoPayment" severity="warn" :closable="false">
        Estamos esperando la confirmación de Mercado Pago. El resultado visual de la plataforma de pago no confirma el pedido; el estado se actualizará desde la tienda.
      </Message>
      <Message v-if="paymentLinkError" severity="error" :closable="false">
        {{ paymentLinkError }}
      </Message>
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
          @click="selectTrackedOrder(order)"
        />
      </nav>

      <Message v-if="trackingFinished" severity="success" :closable="false" class="tracking-message">
        Tu pedido fue completado y ya no se muestra en el seguimiento.
      </Message>

      <Message v-else-if="deletedOrderId !== null" severity="success" :closable="false" class="tracking-message">
        El pedido #{{ deletedOrderId }} se eliminó de este navegador.
      </Message>

      <Message
        v-else-if="requestedPublicOrderId && orderErrors[requestedPublicOrderId]"
        severity="error"
        :closable="false"
        class="tracking-message"
      >
        {{ orderErrors[requestedPublicOrderId] }}
        <Button label="Reintentar" icon="pi pi-refresh" text @click="retrySharedOrderLoad" />
      </Message>

      <Message v-else-if="trackingUnavailable || (!trackedOrder && !orderSaveWarning)" severity="info" :closable="false" class="tracking-message">
        {{ requestedPublicOrderId
          ? 'No pudimos validar el enlace de seguimiento. Abrí el enlace desde el email de la tienda o contactá al comercio.'
          : 'No pudimos acceder al pedido guardado. Si necesitás ayuda, contactá al comercio.' }}
      </Message>

      <Message
        v-if="cancellationMessage && !trackedOrder"
        :severity="cancellationMessageSeverity"
        :closable="false"
        class="tracking-message"
        role="status"
      >
        {{ cancellationMessage }}
      </Message>

      <article v-if="trackedOrder" class="tracked-order">
        <div class="tracked-order-heading">
          <div>
            <p class="tracked-order-number">Pedido #{{ trackedOrder.orderId }}</p>
            <p class="tracked-order-date">{{ formatDate(trackedOrder.createdAt) }}</p>
          </div>
          <span class="status-badge" :class="`tone-${getStatusTone(trackedOrder.orderStatus)}`">
            {{ formatOrderStatus(trackedOrder.orderStatus) }}
          </span>
        </div>
        <section class="tracked-order-actions" aria-labelledby="tracked-order-actions-title">
          <h2 id="tracked-order-actions-title">Acciones del pedido</h2>
          <Message
            v-if="paymentChangeMessage"
            :severity="paymentChangeMessageSeverity"
            :closable="false"
            class="payment-change-message"
            role="status"
          >
            {{ paymentChangeMessage }}
          </Message>
          <div class="tracked-order-action-grid">
            <div v-if="canChangeTrackedPaymentMethod" class="tracked-order-action payment-method-change">
              <h3>Medio de pago</h3>
              <p>
                Medio actual:
                <strong>{{ describePaymentProvider(trackedOrder.paymentProvider).label }}</strong>
              </p>
              <Button
                label="Cambiar medio de pago"
                icon="pi pi-wallet"
                severity="secondary"
                outlined
                @click="openPaymentChangeDialog"
              />
            </div>

            <div
              v-if="trackedOrder.orderTrackingToken && canUploadTransferProof(trackedOrder)"
              class="tracked-order-action proof-region"
            >
              <h3>Comprobante de transferencia</h3>
              <p v-if="trackedOrder.transferAlias">
                Transferí a <strong>{{ trackedOrder.transferAlias }}</strong>
                <template v-if="trackedOrder.transferAccountHolder">, titular <strong>{{ trackedOrder.transferAccountHolder }}</strong></template>.
              </p>
              <small>JPEG, PNG o WebP, hasta 5 MiB.</small>
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
            </div>

            <div v-if="canCancelTrackedOrder" class="tracked-order-action tracked-order-cancellation">
              <h3>Cancelación</h3>
              <Button
                v-if="!confirmingOrderCancellation"
                label="Cancelar pedido"
                icon="pi pi-times"
                severity="danger"
                outlined
                @click="confirmingOrderCancellation = true"
              />
              <div v-else class="tracked-order-cancellation-confirmation">
                <p>¿Querés cancelar el pedido #{{ trackedOrder.orderId }}?</p>
                <label class="cancellation-reason-label">
                  Motivo (opcional)
                  <textarea
                    v-model="cancellationReason"
                    maxlength="255"
                    rows="2"
                    aria-label="Motivo opcional de cancelación"
                    :disabled="cancellingOrder"
                  ></textarea>
                </label>
                <div class="cancellation-actions">
                  <Button
                    label="Confirmar cancelación"
                    icon="pi pi-times"
                    severity="danger"
                    :loading="cancellingOrder"
                    :disabled="cancellingOrder"
                    @click="cancelTrackedOrder"
                  />
                  <Button
                    label="Volver"
                    severity="secondary"
                    text
                    :disabled="cancellingOrder"
                    @click="confirmingOrderCancellation = false"
                  />
                </div>
              </div>
            </div>

            <div v-if="canDeleteTrackedOrder" class="tracked-order-action tracked-order-delete">
              <h3>Seguimiento local</h3>
              <p>Quitar este pedido de la lista guardada en este dispositivo.</p>
              <Button
                v-if="!confirmingOrderDeletion"
                label="Eliminar pedido"
                icon="pi pi-trash"
                severity="danger"
                text
                @click="confirmingOrderDeletion = true"
              />
              <div v-else class="tracked-order-delete-confirmation" role="group" :aria-label="`Confirmar eliminación del pedido ${trackedOrder.orderId}`">
                <p>¿Eliminar el pedido #{{ trackedOrder.orderId }} de este navegador?</p>
                <Button label="Sí, eliminar" icon="pi pi-trash" severity="danger" @click="deleteTrackedOrder" />
                <Button label="Conservar pedido" severity="secondary" outlined @click="confirmingOrderDeletion = false" />
              </div>
            </div>

            <div
              v-if="trackedOrder.publicOrderId && trackedOrder.orderTrackingToken"
              class="tracked-order-action"
            >
              <h3>Compartir</h3>
              <p>Compartí el estado y el detalle de este pedido.</p>
              <Button
                :label="trackingLinkCopied ? 'Link copiado' : 'Compartir pedido'"
                :icon="trackingLinkCopied ? 'pi pi-check' : 'pi pi-copy'"
                severity="secondary"
                outlined
                @click="copyTrackingLink"
              />
              <Message
                v-if="trackingLinkError"
                severity="error"
                :closable="false"
                role="status"
              >
                {{ trackingLinkError }}
              </Message>
            </div>
          </div>
          <Message
            v-if="cancellationMessage"
            :severity="cancellationMessageSeverity"
            :closable="false"
            class="cancellation-message"
            role="status"
          >
            {{ cancellationMessage }}
          </Message>
        </section>
        <OrderStatusTimeline
          :status="trackedOrder.orderStatus"
          :timeline="trackedOrder.statusTimeline"
          :fulfillment-type="trackedOrder.fulfillmentType"
          :payment-provider="trackedOrder.paymentProvider"
        />
        <p v-if="connectionLabel" class="tracking-connection" role="status">{{ connectionLabel }}</p>
        <Message
          v-if="trackedOrder.paymentProvider === 'MERCADO_PAGO' && trackedOrder.orderStatus === 'PENDING_PAYMENT'"
          severity="warn"
          :closable="false"
        >
          Estamos esperando la confirmación de Mercado Pago.
        </Message>
        <Message
          v-else-if="trackedOrder.paymentProvider === 'MERCADO_PAGO' && trackedOrder.orderStatus === 'CONFIRMED'"
          severity="success"
          :closable="false"
        >
          Pago confirmado. Tu pedido fue recibido.
        </Message>

        <section class="tracked-order-information" aria-label="Información del pedido">
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

          <section class="tracked-order-items" aria-labelledby="tracked-order-items-title">
            <h2 id="tracked-order-items-title">Productos del pedido</h2>
            <ul v-if="trackedOrderItems.length">
              <li v-for="(item, index) in trackedOrderItems" :key="`${item.name}-${item.variantLabel}-${index}`">
                <div>
                  <strong>{{ item.name }}</strong>
                  <small v-if="item.variantLabel">{{ item.variantLabel }}</small>
                </div>
                <span>{{ formatQuantityWithUnit(item.quantity, item) }}</span>
              </li>
            </ul>
            <p v-else class="tracked-order-items-empty">
              El detalle de productos no está disponible para este pedido.
            </p>
          </section>
        </section>

        <Message v-if="orderErrors[trackedOrder.orderId]" severity="error" :closable="false">
          {{ orderErrors[trackedOrder.orderId] }}
        </Message>

        <Dialog
          v-model:visible="paymentChangeDialogVisible"
          modal
          header="Cambiar medio de pago"
          :style="{ width: 'min(92vw, 32rem)' }"
          :closable="!changingPaymentMethod"
          :close-on-escape="!changingPaymentMethod"
        >
          <div class="payment-method-dialog">
            <p>
              Medio actual:
              <strong>{{ describePaymentProvider(trackedOrder.paymentProvider).label }}</strong>
            </p>
            <fieldset :disabled="changingPaymentMethod || !canChangeTrackedPaymentMethod">
              <legend>Elegí una alternativa</legend>
              <label v-for="option in paymentChangeOptions" :key="option.provider" class="payment-method-option">
                <input
                  v-model="selectedPaymentProvider"
                  type="radio"
                  name="payment-method"
                  :value="option.provider"
                >
                <span>{{ option.label }}</span>
              </label>
              <p v-if="!paymentChangeOptions.length" class="payment-method-empty">
                No hay otras alternativas disponibles para este pedido.
              </p>
            </fieldset>
            <p class="payment-method-notice">
              Cambiar el medio de pago no modifica los productos ni el total del pedido.
            </p>
            <Message
              v-if="paymentChangeMessage"
              :severity="paymentChangeMessageSeverity"
              :closable="false"
              role="status"
            >
              {{ paymentChangeMessage }}
            </Message>
            <div class="payment-method-actions">
              <Button
                label="Confirmar cambio"
                icon="pi pi-check"
                :loading="changingPaymentMethod"
                :disabled="changingPaymentMethod || !selectedPaymentProvider || !canChangeTrackedPaymentMethod"
                @click="changeTrackedPaymentMethod"
              />
              <Button
                label="Volver"
                severity="secondary"
                text
                :disabled="changingPaymentMethod"
                @click="paymentChangeDialogVisible = false"
              />
            </div>
          </div>
        </Dialog>

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
                <InputText
                  v-model.trim="form.phone"
                  name="phone"
                  type="tel"
                  autocomplete="tel"
                  inputmode="tel"
                  required
                  :invalid="touched.phone && Boolean(phoneError)"
                  :aria-invalid="touched.phone && Boolean(phoneError)"
                  aria-describedby="phone-error"
                  @blur="touched.phone = true"
                />
                <small v-if="touched.phone && phoneError" id="phone-error" class="field-error">{{ phoneError }}</small>
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
            <li v-for="item in items" :key="item.lineId ?? item.id">
              <div class="summary-item-copy">
                <strong>{{ item.name }}</strong>
                <small v-if="item.variantLabel">{{ item.variantLabel }}</small>
                <span>{{ formatQuantity(item) }}</span>
              </div>
              <strong>{{ formatMoney(item.pricePerType * item.quantity) }}</strong>
            </li>
          </ul>
          <div class="summary-totals">
            <div v-if="effectiveDiscount > 0"><span>Subtotal</span><strong>{{ formatMoney(subtotal) }}</strong></div>
            <div v-if="effectiveDiscount > 0" class="summary-discount">
              <span><i class="pi pi-tag" aria-hidden="true"></i> Descuentos</span>
              <strong>-{{ formatMoney(effectiveDiscount) }}</strong>
            </div>
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
            :label="form.paymentProvider === 'MERCADO_PAGO' ? 'Pagar con Mercado Pago' : 'Confirmar pedido'"
            :loading="sending"
            loading-icon="pi pi-spin pi-spinner"
            :aria-label="sending ? 'Enviando pedido' : form.paymentProvider === 'MERCADO_PAGO' ? 'Pagar con Mercado Pago' : 'Confirmar pedido'"
          />
          <Message v-if="sending" severity="info" :closable="false" class="checkout-error" role="status">
            Estamos enviando tu pedido. La tienda puede demorar un poco en confirmarlo, ¡gracias por la paciencia! No cierres esta página.
          </Message>
          <Message v-if="checkoutOutcomeUnknown" severity="warn" :closable="false" class="checkout-error">
            No envíes el checkout otra vez hasta verificar si el pedido fue creado.
          </Message>
          <Message v-if="checkoutError" severity="error" :closable="false" class="checkout-error">
            {{ checkoutError }}
          </Message>
          </template>
        </Card>
      </form>
    </template>

    <aside v-if="supportContact" class="support-block" aria-labelledby="support-title">
      <div>
        <h2 id="support-title">Tengo un problema con mi pedido</h2>
        <p>Contactá a {{ storeName }} y te ayudamos.</p>
      </div>
      <a
        class="support-link"
        :href="supportContact.url"
        :target="supportContact.external ? '_blank' : undefined"
        :rel="supportContact.external ? 'noopener noreferrer' : undefined"
      >
        <i :class="supportContact.icon" aria-hidden="true" />
        {{ supportContact.label }}
      </a>
    </aside>
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

.summary-discount strong,
.summary-discount span {
  color: var(--status-success);
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

.tracked-order-information {
  display: grid;
  gap: 1.25rem;
  padding: 1rem;
  border: 1px solid rgba(24, 37, 28, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
}

.tracked-order-actions {
  display: grid;
  gap: 0.9rem;
  padding-top: 1.1rem;
  border-top: 1px solid rgba(24, 37, 28, 0.12);
}

.tracked-order-actions > h2 {
  margin: 0;
  font-size: 1.05rem;
}

.tracked-order-action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
  align-items: start;
  gap: 0.75rem;
}

@media (min-width: 31rem) {
  .tracked-order-action-grid:has(.tracked-order-cancellation-confirmation) {
    grid-auto-flow: row dense;
  }

  .tracked-order-cancellation:has(.tracked-order-cancellation-confirmation) {
    grid-row: span 2;
  }
}

.tracked-order-action {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid rgba(24, 37, 28, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
}

.tracked-order-action > :deep(.p-button),
.tracked-order-action > .proof-input-label,
.tracked-order-action > .tracked-order-cancellation-confirmation,
.tracked-order-action > .tracked-order-delete-confirmation {
  margin-top: auto;
}

.tracked-order-action h3 {
  margin: 0;
  font-size: 0.94rem;
}

.tracked-order-action > p {
  margin: 0;
  color: #526157;
  font-size: 0.88rem;
  line-height: 1.45;
}

.tracked-order-delete-confirmation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
}

.tracked-order-delete-confirmation p {
  flex: 1 1 100%;
  margin: 0;
  text-align: left;
}

.tracked-order-cancellation-confirmation {
  display: grid;
  width: min(100%, 28rem);
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--status-danger) 30%, #fff);
  border-radius: 12px;
  background: color-mix(in srgb, var(--status-danger) 5%, #fff);
}

.tracked-order-cancellation-confirmation p {
  margin: 0;
  font-weight: 700;
}

.cancellation-reason-label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.cancellation-reason-label textarea {
  width: 100%;
  min-height: 4rem;
  padding: 0.6rem;
  border: 1px solid color-mix(in srgb, var(--primary-color) 35%, #fff);
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}

.cancellation-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 0.5rem;
}

.cancellation-message {
  margin: 0;
}

.payment-method-change p,
.payment-method-dialog p {
  margin: 0;
}

.payment-method-dialog {
  display: grid;
  gap: 1rem;
}

.payment-method-dialog fieldset {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.payment-method-dialog legend {
  margin-bottom: 0.35rem;
  font-weight: 700;
}

.payment-method-option {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--primary-color) 25%, #fff);
  border-radius: 10px;
  cursor: pointer;
}

.payment-method-option:has(input:checked) {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 8%, #fff);
}

.payment-method-option input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--primary-color);
}

.payment-method-notice,
.payment-method-empty {
  color: #526157;
  font-size: 0.9rem;
}

.payment-method-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.payment-change-message {
  margin: 0;
}

.tracked-order-items {
  display: grid;
  gap: 0.65rem;
}

.tracked-order-items h2 {
  margin: 0;
  font-size: 1.05rem;
}

.tracked-order-items ul {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tracked-order-items li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: color-mix(in srgb, var(--secondary-color) 35%, #fff);
}

.tracked-order-items li > div {
  display: grid;
  gap: 0.15rem;
}

.tracked-order-items li small,
.tracked-order-items-empty {
  color: #647167;
  font-size: 0.85rem;
}

.tracked-order-items li > span {
  flex: 0 0 auto;
  font-weight: 700;
}

.tracked-order-items-empty {
  margin: 0;
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

.status-badge {
  --tone: var(--status-neutral);
  --tone-soft: var(--status-neutral-soft);
  display: inline-block;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--tone);
  border-radius: 999px;
  background: var(--tone-soft);
  color: var(--tone);
  font-size: 0.85rem;
  font-weight: 700;
}

.status-badge.tone-success { --tone: var(--status-success); --tone-soft: var(--status-success-soft); }
.status-badge.tone-info { --tone: var(--status-info); --tone-soft: var(--status-info-soft); }
.status-badge.tone-warning { --tone: var(--status-warning); --tone-soft: var(--status-warning-soft); }
.status-badge.tone-progress { --tone: var(--status-progress); --tone-soft: var(--status-progress-soft); }
.status-badge.tone-danger { --tone: var(--status-danger); --tone-soft: var(--status-danger-soft); }

.support-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid #d9e2dc;
  border-radius: 8px;
  background: #fff;
}

.support-block h2 {
  margin: 0;
  font-size: 1rem;
}

.support-block p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.support-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  color: var(--primary-text-color);
  font-weight: 600;
  text-decoration: none;
}

.support-link:hover {
  background: color-mix(in srgb, var(--primary-color) 12%, #fff);
}

.support-link:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary-color) 45%, transparent);
  outline-offset: 2px;
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
