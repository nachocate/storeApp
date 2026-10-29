const FORMSUBMIT_BASE_URL = 'https://formsubmit.co/ajax/'
const REQUEST_TIMEOUT_MS = 15000

export class ContactRequestError extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause })
    this.name = 'ContactRequestError'
  }
}

export const buildContactPayload = (request) => {
  const name = request.name.trim()

  return {
    name,
    phone: request.phone.trim(),
    email: request.email.trim(),
    message: request.message.trim(),
    _subject: `Quiero ser parte de Tiendario - ${name}`,
    _template: 'table',
    _captcha: 'false',
    _honey: ''
  }
}

const isSuccessfulResponse = (data) => data?.success === true || data?.success === 'true'

export const sendContactRequest = async (request, formId, { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(`${FORMSUBMIT_BASE_URL}${encodeURIComponent(formId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildContactPayload(request)),
      signal: controller.signal
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !isSuccessfulResponse(data)) {
      throw new ContactRequestError('El servicio de contacto rechazó la consulta.')
    }
  } catch (error) {
    if (error instanceof ContactRequestError) throw error
    throw new ContactRequestError('No pudimos conectarnos con el servicio de contacto.', { cause: error })
  } finally {
    clearTimeout(timeoutId)
  }
}
