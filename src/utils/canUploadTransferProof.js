const TRANSFER_PROOF_STATUSES = new Set([
  'PENDING_PAYMENT',
  'AWAITING_PAYMENT_PROOF'
])

const normalizeStatus = (status) => String(status ?? '')
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, '_')

export const canUploadTransferProof = (order) =>
  order?.paymentProvider === 'TRANSFER' &&
  [order.orderStatus, order.status, order.paymentStatus]
    .some((status) => TRANSFER_PROOF_STATUSES.has(normalizeStatus(status)))