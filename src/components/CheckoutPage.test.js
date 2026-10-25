import { createApp, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import CheckoutPage from './CheckoutPage.vue'

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
  orderTrackingToken: 'tracking-token',
  orderStatus,
  paymentProvider: 'TRANSFER',
  fulfillmentType: 'PICKUP',
  totalAmount: '1000',
  currency: 'ARS',
  createdAt: '2026-10-25T12:00:00.000Z'
})

const render = (orderStatus, orderProperties = {}) => {
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
    submitTransferProof: vi.fn()
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
  app.component('Card', { template: '<div><slot /></div>' })
  app.mount(container)

  return { app, container, removeOrder, cancelOrder, changePaymentMethod, orders }
}

describe('CheckoutPage cancelled order removal', () => {
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

  it('asks for confirmation and submits an optional cancellation reason only when allowed', async () => {
    const { app, container, cancelOrder } = render('CONFIRMED', { canCancelOrder: true })

    container.querySelector('.tracked-order-cancellation > button').click()
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
