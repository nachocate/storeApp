import { isValidEmail } from './invoiceData.js'

export const CONTACT_FIELD_LIMITS = {
  name: 80,
  phone: 30,
  email: 120,
  message: 1000
}

export const MIN_MESSAGE_LENGTH = 10
const MIN_PHONE_DIGITS = 8

export const createEmptyContactRequest = () => ({
  name: '',
  phone: '',
  email: '',
  message: ''
})

const validateName = (value) => {
  if (!value) return 'Ingresá tu nombre.'
  if (value.length < 2) return 'El nombre debe tener al menos 2 caracteres.'
  if (value.length > CONTACT_FIELD_LIMITS.name) return `Usá hasta ${CONTACT_FIELD_LIMITS.name} caracteres.`
  return ''
}

const validatePhone = (value) => {
  if (!value) return 'Ingresá un teléfono de contacto.'
  if (!/^\+?[\d\s()-]+$/.test(value)) return 'Usá sólo números, espacios, guiones o paréntesis.'
  if (value.replace(/\D/g, '').length < MIN_PHONE_DIGITS) return `El teléfono debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`
  if (value.length > CONTACT_FIELD_LIMITS.phone) return `Usá hasta ${CONTACT_FIELD_LIMITS.phone} caracteres.`
  return ''
}

const validateEmail = (value) => {
  if (!value) return 'Ingresá tu correo electrónico.'
  if (value.length > CONTACT_FIELD_LIMITS.email || !isValidEmail(value)) return 'Ingresá un correo válido, por ejemplo nombre@correo.com.'
  return ''
}

const validateMessage = (value) => {
  if (!value) return 'Contanos sobre tu tienda o dejanos tu consulta.'
  if (value.length < MIN_MESSAGE_LENGTH) return `Escribí al menos ${MIN_MESSAGE_LENGTH} caracteres.`
  if (value.length > CONTACT_FIELD_LIMITS.message) return `Usá hasta ${CONTACT_FIELD_LIMITS.message} caracteres.`
  return ''
}

const FIELD_VALIDATORS = {
  name: validateName,
  phone: validatePhone,
  email: validateEmail,
  message: validateMessage
}

export const validateContactField = (field, value) =>
  FIELD_VALIDATORS[field]?.(String(value ?? '').trim()) ?? ''

export const validateContactRequest = (request) =>
  Object.fromEntries(Object.keys(FIELD_VALIDATORS)
    .map((field) => [field, validateContactField(field, request[field])])
    .filter(([, error]) => error))
