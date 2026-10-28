const RETURN_TTL_MS = 24 * 60 * 60 * 1000

const returnStorageKey = (storeSlug) =>
  `vitrinapp-mercadopago-return-${encodeURIComponent(storeSlug)}`

const getStorages = (storage) => {
  if (storage) return [storage]

  return ['sessionStorage', 'localStorage'].flatMap((key) => {
    try {
      const targetStorage = globalThis[key]
      return targetStorage ? [targetStorage] : []
    } catch {
      return []
    }
  })
}

export const rememberMercadoPagoReturnPublicOrderId = (
  storeSlug,
  publicOrderId,
  storage,
  now = () => Date.now()
) => {
  if (publicOrderId === undefined || publicOrderId === null || String(publicOrderId).trim() === '') return false

  const value = JSON.stringify({
    publicOrderId: String(publicOrderId).trim(),
    expiresAt: now() + RETURN_TTL_MS
  })
  let saved = false
  for (const targetStorage of getStorages(storage)) {
    try {
      targetStorage.setItem(returnStorageKey(storeSlug), value)
      saved = true
    } catch {
      continue
    }
  }
  return saved
}

export const takeMercadoPagoReturnPublicOrderId = (
  storeSlug,
  storage,
  now = () => Date.now()
) => {
  const storages = getStorages(storage)
  const key = returnStorageKey(storeSlug)
  let publicOrderId = ''

  for (const targetStorage of storages) {
    let value
    try {
      value = targetStorage.getItem(key)
    } catch {
      continue
    }
    if (!value) continue

    try {
      const saved = JSON.parse(value)
      if (typeof saved?.publicOrderId === 'string' &&
        Number(saved.expiresAt) > now()) {
        publicOrderId = saved.publicOrderId
        break
      }
    } catch {
      publicOrderId = value
      break
    }
  }

  for (const targetStorage of storages) {
    try {
      targetStorage.removeItem(key)
    } catch {
      continue
    }
  }
  return publicOrderId
}
