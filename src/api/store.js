import { STORE_SLUG } from '../config/store.js'

export const storeApiPath = `/api/v1/stores/${encodeURIComponent(STORE_SLUG)}`

export const requestStoreApi = async (path, {
  method = 'GET',
  cartToken,
  orderTrackingToken,
  body,
  formData,
  query
} = {}) => {
  const headers = { Accept: 'application/json' }
  if (cartToken) headers['X-Cart-Token'] = cartToken
  if (orderTrackingToken) headers['X-Order-Tracking-Token'] = orderTrackingToken
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const queryString = query
    ? new URLSearchParams(Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])).toString()
    : ''
  const querySeparator = path.includes('?') ? '&' : '?'
  const url = `${storeApiPath}${path}${queryString ? `${querySeparator}${queryString}` : ''}`

  const response = await fetch(url, {
    method,
    headers,
    ...(formData !== undefined
      ? { body: formData }
      : body === undefined
        ? {}
        : { body: JSON.stringify(body) })
  })

  if (!response.ok) {
    let message = `Error de API (${response.status})`
    let errorCode
    try {
      const payload = await response.json()
      message = payload.message ?? payload.error ?? message
      errorCode = payload.code ?? payload.error
    } catch {
      // The response may not contain JSON.
    }
    const error = new Error(message)
    error.status = response.status
    error.code = errorCode
    throw error
  }

  if (response.status === 204) return null
  return response.json()
}