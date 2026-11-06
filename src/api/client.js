export const requestApi = async (url, {
  method = 'GET',
  headers: extraHeaders = {},
  body,
  formData
} = {}) => {
  const headers = { Accept: 'application/json', ...extraHeaders }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

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
      const errorPayload = payload?.error && typeof payload.error === 'object'
        ? payload.error
        : payload?.data?.error && typeof payload.data.error === 'object'
          ? payload.data.error
          : payload?.data ?? payload
      message = errorPayload?.message ?? payload?.message ??
        (typeof payload?.error === 'string' ? payload.error : message)
      errorCode = errorPayload?.code ?? errorPayload?.errorCode ??
        payload?.code ?? payload?.errorCode ??
        (typeof payload?.error === 'string' ? payload.error : undefined)
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
