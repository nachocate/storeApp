const ORDER_STATUS_LABELS = {
  PENDING: 'Pendiente',
  PENDING_AVAILABILITY: 'Esperando confirmación de disponibilidad',
  PENDING_PAYMENT: 'Pendiente de pago',
  AWAITING_PAYMENT: 'Pendiente de pago',
  AWAITING_PAYMENT_PROOF: 'A la espera del comprobante',
  PAYMENT_PROOF_UNDER_REVIEW: 'Comprobante en revisión',
  PAYMENT_UNDER_REVIEW: 'Comprobante en revisión',
  UNDER_REVIEW: 'En revisión',
  CONFIRMED: 'Confirmado',
  PREPARING: 'En preparación',
  READY_FOR_PICKUP: 'Listo para retirar',
  READY_FOR_DISPATCH: 'Listo para despachar',
  OUT_FOR_DELIVERY: 'En camino',
  DELIVERED: 'Entregado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  CANCELED: 'Cancelado',
  REJECTED: 'Rechazado',
  FAILED: 'No se pudo completar'
}

export const formatOrderStatus = (status) => {
  const normalizedStatus = String(status ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

  if (!normalizedStatus) return 'Estado no disponible'
  return ORDER_STATUS_LABELS[normalizedStatus] ?? String(status).trim()
}