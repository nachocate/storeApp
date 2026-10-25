const returnStorageKey = (storeSlug) =>
  `vitrinapp-mercadopago-return-${encodeURIComponent(storeSlug)}`

export const rememberMercadoPagoReturn = (storeSlug, orderId, storage) => {
  if (orderId === undefined || orderId === null || String(orderId).trim() === '') return false
  try {
    const targetStorage = storage ?? globalThis.sessionStorage
    targetStorage.setItem(returnStorageKey(storeSlug), String(orderId))
    return true
  } catch {
    return false
  }
}

export const takeMercadoPagoReturnOrderId = (storeSlug, storage) => {
  try {
    const targetStorage = storage ?? globalThis.sessionStorage
    const key = returnStorageKey(storeSlug)
    const orderId = targetStorage.getItem(key) ?? ''
    if (orderId) targetStorage.removeItem(key)
    return orderId
  } catch {
    return ''
  }
}
