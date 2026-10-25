const getCheckoutPayload = (result) => result?.data ?? result

export const normalizeCheckoutOrder = (result) => {
  const payload = getCheckoutPayload(result)
  const order = result?.order ?? payload?.order ??
    (payload?.orderId !== undefined ? payload : result)
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return { order: null, mercadoPagoCheckoutUrl: '' }
  }

  const orderTrackingToken = order.orderTrackingToken ??
    payload?.orderTrackingToken ??
    result?.orderTrackingToken
  const mercadoPagoCheckoutUrl = order.mercadoPagoCheckoutUrl ??
    payload?.mercadoPagoCheckoutUrl ??
    result?.mercadoPagoCheckoutUrl ??
    ''

  return {
    order: {
      ...order,
      orderStatus: order.orderStatus ?? order.status,
      ...(orderTrackingToken ? { orderTrackingToken } : {}),
      mercadoPagoCheckoutUrl
    },
    mercadoPagoCheckoutUrl
  }
}
