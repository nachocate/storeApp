import { formatOrderStatus } from './formatOrderStatus.js'

const TIMELINE_STATES = new Set(['COMPLETED', 'CURRENT', 'UPCOMING'])

const STATUS_TONES = {
  PENDING: 'warning',
  PENDING_AVAILABILITY: 'warning',
  PENDING_PAYMENT: 'warning',
  AWAITING_PAYMENT: 'warning',
  AWAITING_PAYMENT_PROOF: 'warning',
  PAYMENT_PROOF_UNDER_REVIEW: 'info',
  PAYMENT_UNDER_REVIEW: 'info',
  UNDER_REVIEW: 'info',
  CONFIRMED: 'success',
  PREPARING: 'progress',
  READY_FOR_PICKUP: 'success',
  READY_FOR_DISPATCH: 'progress',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  CANCELED: 'danger',
  REJECTED: 'danger',
  FAILED: 'danger'
}

const STATUS_MESSAGES = {
  PENDING_AVAILABILITY: 'La tienda está revisando que tenga todo lo que pediste. Puede demorar un poco en confirmar tu pedido, ¡gracias por la paciencia!',
  PENDING_PAYMENT: 'Estamos esperando la confirmación del pago. Puede demorar unos minutos.',
  AWAITING_PAYMENT: 'Estamos esperando la confirmación del pago. Puede demorar unos minutos.',
  AWAITING_PAYMENT_PROOF: 'Tu pedido está listo para avanzar: sólo falta que adjuntes el comprobante de pago.',
  PAYMENT_PROOF_UNDER_REVIEW: 'La tienda está revisando tu comprobante. Puede demorar un poco, no hace falta que hagas nada más.',
  PAYMENT_UNDER_REVIEW: 'La tienda está revisando tu comprobante. Puede demorar un poco, no hace falta que hagas nada más.',
  UNDER_REVIEW: 'La tienda está revisando tu pedido. Puede demorar un poco.',
  PENDING: 'La tienda todavía tiene que confirmar tu pedido. Puede demorar un poco.',
  CONFIRMED: '¡Pedido confirmado! La tienda ya lo tiene en cuenta.',
  PREPARING: 'Están preparando tu pedido con cuidado.',
  READY_FOR_PICKUP: '¡Tu pedido está listo para retirar!',
  READY_FOR_DISPATCH: 'Tu pedido está listo y esperando salir hacia tu domicilio.',
  OUT_FOR_DELIVERY: '¡Tu pedido está en camino!',
  DELIVERED: '¡Tu pedido fue entregado! Que lo disfrutes.',
  COMPLETED: '¡Pedido completado! Gracias por tu compra.',
  CANCELLED: 'Este pedido fue cancelado.',
  CANCELED: 'Este pedido fue cancelado.',
  REJECTED: 'La tienda no pudo aceptar este pedido.',
  FAILED: 'No se pudo completar este pedido.'
}

const WAITING_STATUSES = new Set([
  'PENDING',
  'PENDING_AVAILABILITY',
  'PENDING_PAYMENT',
  'AWAITING_PAYMENT',
  'PAYMENT_PROOF_UNDER_REVIEW',
  'PAYMENT_UNDER_REVIEW',
  'UNDER_REVIEW'
])

const normalizeCode = (status) => String(status ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')

export const getStatusTone = (status) => STATUS_TONES[normalizeCode(status)] ?? 'neutral'

export const getStatusMessage = (status) => STATUS_MESSAGES[normalizeCode(status)] ?? ''

export const isWaitingStatus = (status) => WAITING_STATUSES.has(normalizeCode(status))

export const isTerminalFailureStatus = (status) => getStatusTone(status) === 'danger'

export const normalizeStatusTimeline = (timeline) => {
  if (!Array.isArray(timeline)) return undefined

  const steps = timeline
    .filter((step) => step && typeof step.code === 'string' && step.code && TIMELINE_STATES.has(step.state))
    .map((step) => ({
      code: step.code,
      label: typeof step.label === 'string' && step.label ? step.label : step.code,
      state: step.state
    }))

  return steps.length ? steps : undefined
}

export const getCurrentStepIndex = (timeline) => {
  const currentIndex = timeline.findIndex((step) => step.state === 'CURRENT')
  if (currentIndex >= 0) return currentIndex

  const completedCount = timeline.filter((step) => step.state === 'COMPLETED').length
  return Math.max(0, completedCount - 1)
}

// Used only when the API does not send statusTimeline; mirrors the order of the real flow.
export const buildFallbackTimeline = ({ status, fulfillmentType, paymentProvider }) => {
  const code = normalizeCode(status)
  const route = ['PENDING_AVAILABILITY']

  if (paymentProvider === 'TRANSFER') route.push('AWAITING_PAYMENT_PROOF', 'PAYMENT_PROOF_UNDER_REVIEW')
  if (paymentProvider === 'MERCADO_PAGO') route.push('PENDING_PAYMENT')
  route.push('CONFIRMED', 'PREPARING')
  route.push(...(fulfillmentType === 'PICKUP'
    ? ['READY_FOR_PICKUP']
    : ['READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY']))
  route.push('COMPLETED')

  const currentIndex = route.indexOf(code)
  if (currentIndex < 0) return [{ code, label: formatOrderStatus(code), state: 'CURRENT' }]

  return route.map((stepCode, index) => ({
    code: stepCode,
    label: formatOrderStatus(stepCode),
    state: index < currentIndex ? 'COMPLETED' : index === currentIndex ? 'CURRENT' : 'UPCOMING'
  }))
}
