const mercadoPagoHostPattern = /(^|\.)mercadopago\.(com(?:\.[a-z]{2})?|[a-z]{2})$/i

export const resolveMercadoPagoCheckoutUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return ''

  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('La API devolvió una URL de pago inválida.')
  }

  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    !mercadoPagoHostPattern.test(url.hostname)
  ) {
    throw new Error('La API devolvió una URL que no pertenece a Mercado Pago.')
  }

  return url.href
}

export const isPendingMercadoPagoOrder = (order) =>
  order?.paymentProvider === 'MERCADO_PAGO' &&
  order?.orderStatus === 'PENDING_PAYMENT'
