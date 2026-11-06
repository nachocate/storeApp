import { requestApi } from './client.js'

export const VENDOR_INQUIRIES_PATH = '/api/v1/vendor-inquiries'

const VALIDATION_STATUSES = new Set([400, 422])

export const buildVendorInquiry = (request) => ({
  name: request.name.trim(),
  phone: request.phone.trim(),
  email: request.email.trim(),
  message: request.message.trim()
})

export const getVendorInquiryErrorMessage = (error) => {
  if (error?.status === 429) {
    return 'Recibimos varias consultas seguidas. Esperá un minuto y volvé a intentar.'
  }
  if (VALIDATION_STATUSES.has(error?.status)) {
    return 'Revisá los datos ingresados: alguno no tiene un formato válido.'
  }
  if (typeof error?.status === 'number') {
    return 'No pudimos enviar tu consulta en este momento. Intentá de nuevo en unos minutos.'
  }
  return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'
}

export const submitVendorInquiry = (request) =>
  requestApi(VENDOR_INQUIRIES_PATH, { method: 'POST', body: buildVendorInquiry(request) })
