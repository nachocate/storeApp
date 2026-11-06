import { createApp, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import CheckoutPage from './CheckoutPage.vue'
import { STORE_SLUG } from '../config/store.js'
import { takeMercadoPagoReturnPublicOrderId } from '../utils/mercadoPagoReturn.js'

vi.mock('../api/store.js', () => ({
  requestStoreApi: vi.fn(async (path) => path === '/carts/current/checkout-options'
    ? { checkoutEnabled: false, fulfillmentOptions: [] }
    : {})
}))

vi.mock('../composables/useOrderTracking.js', async () => {
  const { ref } = await import('vue')
  return {
    useOrderTracking: () => ({
      connection: ref('closed'),
      finished: ref(false),
      unavailable: ref(false)
    })
  }
})

const makeOrder = (orderStatus) => ({
  orderId: 42,
  publicOrderId: 'public-order-id',
  orderTrackingToken: 'tracking-token',
  orderStatus,
  paymentProvider: 'TRANSFER',
  fulfillmentType: 'PICKUP',
  totalAmount: '1000',
  currency: 'ARS',
  createdAt: '2026-10-25T12:00:00.000Z'
})

const render = (orderStatus, orderProperties = {}, propOverrides = {}) => {
  const container = document.createElement('div')
  const orders = ref([{ ...makeOrder(orderStatus), ...orderProperties }])
  const removeOrder = vi.fn((orderId) => {
    orders.value.splice(orders.value.findIndex((order) => order.orderId === orderId), 1)
  })
  const cancelOrder = vi.fn().mockResolvedValue('cancelled')
  const changePaymentMethod = vi.fn().mockResolvedValue('changed')
  const app = createApp(CheckoutPage, {
    items: [],
    subtotal: 0,
    discountAmount: 0,
    totalAmount: 0,
    currency: 'ARS',
    storeName: 'Tienda',
    saveOrder: vi.fn(),
    refreshCart: vi.fn(),
    orders: orders.value,
    trackedOrderId: 42,
    cancelOrder,
    changePaymentMethod,
    removeOrder,
    syncOrder: vi.fn(),
    orderErrors: {},
    transferErrors: {},
    transferSuccess: {},
    uploadingProofs: {},
    submitTransferProof: vi.fn(),
    ...propOverrides
  })
  app.component('Button', {
    props: ['label'],
    template: '<button type="button" v-bind="$attrs">{{ label }}</button>'
  })
  app.component('Message', {
    template: '<div><slot /></div>'
  })
  app.component('Dialog', {
    props: ['visible'],
    template: '<div v-if="visible" role="dialog"><slot /></div>'
  })
  app.component('InputText', { template: '<input>' })
  app.component('RadioButton', { template: '<input type="radio">' })
  app.component('Textarea', { template: '<textarea />' })
  app.component('Card', { template: '<div><slot name="title" /><slot name="content" /><slot /></div>' })
  app.mount(container)

  return { app, container, removeOrder, cancelOrder, changePaymentMethod, orders }
}

describe('CheckoutPage cancelled order removal', () => {
  it('renders cart item quantities in checkout mode', async () => {
    const { app, container } = render(null, {}, {
      trackedOrderId: null,
      items: [{
        id: 'product-1',
        name: 'Producto',
        quantity: 1,
        quantityType: 'unit',
        decimalScale: 0,
        unitSymbol: 'u',
        pricePerType: 100
      }]
    })
    await nextTick()

    expect(container.textContent).toContain('Producto')
    expect(container.textContent).toContain('1 u')
    app.unmount()
  })

  it('keeps a public order id in tracking mode when no local order is loaded yet', () => {
    const { app, container } = render(null, {}, {
      trackedOrderId: null,
      requestedPublicOrderId: 'public-order-id'
    })

    expect(container.textContent).toContain('Estado de tu pedido')
    expect(container.textContent).not.toContain('Finalizar compra')
    app.unmount()
  })

  it('shows the tracking load error for the requested public order', () => {
    const { app, container } = render(null, {}, {
      trackedOrderId: null,
      requestedPublicOrderId: 'public-order-id',
      orderErrors: { 'public-order-id': 'No se pudo cargar el pedido.' }
    })

    expect(container.textContent).toContain('No se pudo cargar el pedido.')
    app.unmount()
  })

  it('offers to retry the saved payment link for a pending Mercado Pago order', async () => {
    const checkoutUrl = 'https://www.mercadopago.com/checkout'
    takeMercadoPagoReturnPublicOrderId(STORE_SLUG)
    const assignSpy = vi.spyOn(Object.getPrototypeOf(window.location), 'assign')
      .mockImplementation(() => {})
    const { app, container } = render('PENDING_PAYMENT', {
      paymentProvider: 'MERCADO_PAGO',
      mercadoPagoCheckoutUrl: checkoutUrl
    })

    try {
      const retryButton = container.querySelector('.mercado-pago-retry button')
      expect(retryButton.textContent).toBe('Reintentar pago')

      retryButton.click()
      await nextTick()

      expect(assignSpy).toHaveBeenCalledWith(checkoutUrl)
      expect(takeMercadoPagoReturnPublicOrderId(STORE_SLUG)).toBe('public-order-id')
    } finally {
      assignSpy.mockRestore()
      app.unmount()
    }
  })

  it('does not offer Mercado Pago retry for other providers or completed payments', () => {
    const transferOrder = render('PENDING_PAYMENT', {
      mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout'
    })
    expect(transferOrder.container.querySelector('.mercado-pago-retry')).toBeNull()
    transferOrder.app.unmount()

    const confirmedOrder = render('CONFIRMED', {
      paymentProvider: 'MERCADO_PAGO',
      mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout'
    })
    expect(confirmedOrder.container.querySelector('.mercado-pago-retry')).toBeNull()
    confirmedOrder.app.unmount()
  })

  it('matches the payment buttons style and keeps cancellation as the last action card', () => {
    const { app, container } = render('PENDING_PAYMENT', {
      paymentProvider: 'MERCADO_PAGO',
      mercadoPagoCheckoutUrl: 'https://www.mercadopago.com/checkout',
      canChangePaymentMethod: true,
      availablePaymentMethodChanges: [{ provider: 'TRANSFER', label: 'Transferencia' }],
      canCancelOrder: true
    })
    const retryButton = container.querySelector('.mercado-pago-retry button')
    const changeMethodButton = container.querySelector('.payment-method-change button')
    const actionGrid = container.querySelector('.tracked-order-action-grid')

    expect(retryButton.getAttribute('severity')).toBe(changeMethodButton.getAttribute('severity'))
    expect(retryButton.hasAttribute('outlined')).toBe(changeMethodButton.hasAttribute('outlined'))
    expect(actionGrid.lastElementChild.classList.contains('tracked-order-cancellation')).toBe(true)
    app.unmount()
  })

  it('requires confirmation before removing a cancelled order', async () => {
    const { app, container, removeOrder } = render('CANCELLED')

    container.querySelector('.tracked-order-delete button').click()
    await nextTick()

    expect(container.textContent).toContain('¿Eliminar el pedido #42')
    expect(removeOrder).not.toHaveBeenCalled()

    container.querySelector('.tracked-order-delete-confirmation button').click()
    await nextTick()

    expect(removeOrder).toHaveBeenCalledWith(42)
    expect(container.textContent).toContain('se eliminó de este navegador')
    app.unmount()
  })

  it('does not offer removal for an active order', () => {
    const { app, container, removeOrder } = render('PREPARING')

    expect(container.textContent).not.toContain('Eliminar pedido')
    expect(removeOrder).not.toHaveBeenCalled()

    app.unmount()
  })

  it('shows product names, variants and quantities in order tracking', () => {
    const { app, container } = render('PREPARING', {
      items: [{
        name: 'Café',
        variantLabel: 'Molido',
        quantity: 0.5,
        unitSymbol: 'kg',
        decimalScale: 3
      }]
    })

    const details = container.querySelector('.tracked-order-items')
    expect(details.textContent).toContain('Café')
    expect(details.textContent).toContain('Molido')
    expect(details.textContent).toContain('500 g')
    const orderStatus = container.querySelector('.tracked-order-heading .status-badge')
    const actions = container.querySelector('.tracked-order-actions')
    const route = container.querySelector('.order-timeline')
    expect(orderStatus.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(actions.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(route.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    app.unmount()
  })

  it('places transfer proof guidance above its control and keeps action controls last in their cards', () => {
    const { app, container } = render('PENDING_PAYMENT', {
      canCancelOrder: true,
      transferAlias: 'tienda.transferencia'
    })

    const proofCard = container.querySelector('.proof-region')
    const proofGuidance = proofCard.querySelector('small')
    const proofControl = proofCard.querySelector('.proof-input-label')
    const proofFooter = proofCard.querySelector('.tracked-order-action-footer')
    expect(proofGuidance.textContent).toContain('JPEG, PNG o WebP')
    expect(proofGuidance.compareDocumentPosition(proofControl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(proofCard.lastElementChild).toBe(proofFooter)
    expect(proofFooter.firstElementChild).toBe(proofControl)

    const cancellationCard = container.querySelector('.tracked-order-cancellation')
    expect(cancellationCard.lastElementChild.textContent).toContain('Cancelar pedido')

    app.unmount()
  })

  it('copies a shareable order link and shows a temporary confirmation', async () => {
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    const { app, container } = render('PREPARING')

    container.querySelector('.tracked-order-actions button').click()
    await Promise.resolve()
    await nextTick()

    expect(writeText).toHaveBeenCalledOnce()
    const sharedUrl = new URL(writeText.mock.calls[0][0])
    expect(sharedUrl.pathname).toContain('/orders/public-order-id')
    expect(sharedUrl.hash).toContain('trackingToken=tracking-token')
    expect(sharedUrl.search).toBe('')
    expect(container.querySelector('.tracked-order-actions button').textContent)
      .toContain('Link copiado')

    app.unmount()
    if (previousClipboard) {
      Object.defineProperty(navigator, 'clipboard', previousClipboard)
    } else {
      delete navigator.clipboard
    }
  })

  it('asks for confirmation and submits an optional cancellation reason only when allowed', async () => {
    const { app, container, cancelOrder } = render('CONFIRMED', { canCancelOrder: true })

    container.querySelector('.tracked-order-cancellation button').click()
    await nextTick()

    expect(container.textContent).toContain('¿Querés cancelar el pedido #42?')
    expect(cancelOrder).not.toHaveBeenCalled()

    const reason = container.querySelector('.cancellation-reason-label textarea')
    reason.value = 'Ya no lo necesito.'
    reason.dispatchEvent(new Event('input'))
    await nextTick()
    container.querySelector('.cancellation-actions button').click()
    await nextTick()
    await Promise.resolve()
    await nextTick()

    expect(cancelOrder).toHaveBeenCalledWith(42, 'Ya no lo necesito.')
    expect(container.textContent).toContain('El pedido se canceló correctamente.')
    app.unmount()
  })

  it('does not offer cancellation unless the API explicitly allows it', () => {
    const { app, container, cancelOrder } = render('CONFIRMED', { canCancelOrder: false })

    expect(container.textContent).not.toContain('Cancelar pedido')
    expect(cancelOrder).not.toHaveBeenCalled()

    app.unmount()
  })

  it('does not offer cancellation once preparation has started even if the API flag is true', () => {
    const { app, container, cancelOrder } = render('PREPARING', { canCancelOrder: true })

    expect(container.textContent).not.toContain('Cancelar pedido')
    expect(cancelOrder).not.toHaveBeenCalled()

    app.unmount()
  })

  it('shows only API-provided alternative payment methods and confirms the selected one', async () => {
    const { app, container, changePaymentMethod, orders } = render('PENDING_PAYMENT', {
      paymentProvider: 'MERCADO_PAGO',
      canChangePaymentMethod: true,
      availablePaymentMethodChanges: [
        { provider: 'TRANSFER', label: 'Transferencia bancaria' },
        { provider: 'CASH', label: 'Efectivo' }
      ]
    })
    changePaymentMethod.mockImplementation(async (orderId, provider) => {
      Object.assign(orders.value[0], {
        paymentProvider: provider,
        canChangePaymentMethod: false
      })
      return 'changed'
    })

    container.querySelector('.payment-method-change button').click()
    await nextTick()

    expect(container.textContent).toContain('Transferencia bancaria')
    expect(container.textContent).toContain('Efectivo')
    expect([...container.querySelectorAll('.payment-method-option input')].map((input) => input.value))
      .toEqual(['TRANSFER', 'CASH'])
    expect(container.textContent).toContain('no modifica los productos ni el total')

    const cashOption = [...container.querySelectorAll('.payment-method-option input')]
      .find((input) => input.value === 'CASH')
    cashOption.checked = true
    cashOption.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    container.querySelector('.payment-method-actions button').click()
    await nextTick()
    await Promise.resolve()
    await nextTick()

    expect(changePaymentMethod).toHaveBeenCalledWith(42, 'CASH')
    expect(container.textContent).toContain('El medio de pago cambió a Efectivo.')
    app.unmount()
  })

  it('does not show payment options without API authorization', () => {
    const { app, container, changePaymentMethod } = render('PENDING_PAYMENT', {
      paymentProvider: 'MERCADO_PAGO',
      canChangePaymentMethod: false,
      availablePaymentMethodChanges: [{ provider: 'TRANSFER', label: 'Transferencia' }]
    })

    expect(container.textContent).not.toContain('Cambiar medio de pago')
    expect(changePaymentMethod).not.toHaveBeenCalled()

    app.unmount()
  })
})
