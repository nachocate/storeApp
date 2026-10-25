const returnStorageKey = (storeSlug) =>
  `vitrinapp-mercadopago-return-${encodeURIComponent(storeSlug)}`

export const rememberMercadoPagoReturnPublicOrderId = (storeSlug, publicOrderId, storage) => {
  if (publicOrderId === undefined || publicOrderId === null || String(publicOrderId).trim() === '') return false
  try {
    const targetStorage = storage ?? globalThis.sessionStorage
    targetStorage.setItem(returnStorageKey(storeSlug), String(publicOrderId))
    return true
  } catch {
    return false
  }
}

export const takeMercadoPagoReturnPublicOrderId = (storeSlug, storage) => {
  try {
    const targetStorage = storage ?? globalThis.sessionStorage
    const key = returnStorageKey(storeSlug)
    const publicOrderId = targetStorage.getItem(key) ?? ''
    if (publicOrderId) targetStorage.removeItem(key)
    return publicOrderId
  } catch {
    return ''
  }
}
