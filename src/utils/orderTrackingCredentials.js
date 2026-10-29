const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

const storageKey = (storeSlug, publicOrderId) =>
  `tiendario-order-tracking-${encodeURIComponent(storeSlug)}-${encodeURIComponent(publicOrderId)}`

export const rememberOrderTrackingToken = (
  storeSlug,
  publicOrderId,
  token,
  storage,
  now = () => Date.now()
) => {
  if (!publicOrderId || typeof token !== 'string' || !token) return false

  try {
    const targetStorage = storage ?? globalThis.sessionStorage
    targetStorage.setItem(storageKey(storeSlug, publicOrderId), JSON.stringify({
      token,
      expiresAt: now() + TOKEN_TTL_MS
    }))
    return true
  } catch {
    return false
  }
}

export const readOrderTrackingToken = (
  storeSlug,
  publicOrderId,
  storage,
  now = () => Date.now()
) => {
  if (!publicOrderId) return ''

  try {
    const targetStorage = storage ?? globalThis.sessionStorage
    const key = storageKey(storeSlug, publicOrderId)
    const saved = JSON.parse(targetStorage.getItem(key) ?? 'null')
    if (typeof saved?.token !== 'string' || !saved.token) return ''
    const expiresAt = Number(saved.expiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= now()) {
      targetStorage.removeItem(key)
      return ''
    }
    return saved.token
  } catch {
    return ''
  }
}

export const forgetOrderTrackingToken = (
  storeSlug,
  publicOrderId,
  storage
) => {
  if (!publicOrderId) return
  try {
    const targetStorage = storage ?? globalThis.sessionStorage
    targetStorage.removeItem(storageKey(storeSlug, publicOrderId))
  } catch {
    return
  }
}

export const consumeOrderTrackingTokenFromHash = ({
  storeSlug,
  publicOrderId,
  location = globalThis.window?.location,
  history = globalThis.window?.history,
  storage
}) => {
  if (!location || !history || !location.hash) return ''

  const fragment = location.hash.slice(1)
  const token = new URLSearchParams(fragment).get('trackingToken') ?? ''
  if (token && publicOrderId) {
    rememberOrderTrackingToken(storeSlug, publicOrderId, token, storage)
  }
  history.replaceState(history.state, '', `${location.pathname}${location.search}`)
  return token && publicOrderId ? token : ''
}
