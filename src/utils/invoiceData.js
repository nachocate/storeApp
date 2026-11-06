export const INVOICE_DOCUMENT_TYPES = ['DNI', 'CUIL', 'CUIT']
export const INVOICE_MODES = ['DISABLED', 'OPTIONAL', 'REQUIRED']

export const resolveInvoiceMode = (settings) => {
  const mode = settings?.customerInvoiceDataMode
  return INVOICE_MODES.includes(mode) ? mode : 'DISABLED'
}

export const validateInvoiceData = (value = {}) => {
  const errors = {}
  const legalName = String(value.legalName ?? '').trim()
  const documentNumber = String(value.documentNumber ?? '').replace(/\D/g, '')

  if (!legalName) errors.legalName = 'Ingresá el nombre completo o la razón social.'
  else if (legalName.length > 160) errors.legalName = 'Usá como máximo 160 caracteres.'

  if (!INVOICE_DOCUMENT_TYPES.includes(value.documentType)) {
    errors.documentType = 'Elegí un tipo de documento.'
  }

  const validLength = value.documentType === 'DNI'
    ? documentNumber.length === 7 || documentNumber.length === 8
    : documentNumber.length === 11
  if (!validLength) {
    errors.documentNumber = value.documentType === 'DNI'
      ? 'El DNI debe tener 7 u 8 dígitos.'
      : 'El CUIL/CUIT debe tener 11 dígitos.'
  }

  return { errors, data: Object.keys(errors).length ? null : { legalName, documentType: value.documentType, documentNumber } }
}

export const buildInvoiceData = (mode, wantsInvoice, value) => {
  if (mode === 'DISABLED') return undefined
  if (mode === 'OPTIONAL' && !wantsInvoice) return undefined
  return validateInvoiceData(value).data ?? undefined
}

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
