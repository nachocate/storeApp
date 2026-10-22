export const isValidCustomerPhone = (value) => {
  if (typeof value !== 'string') return false

  const phone = value.trim()
  const digitCount = phone.replace(/\D/g, '').length
  return /^\+?[\d\s().-]+$/.test(phone) && digitCount >= 8 && digitCount <= 15
}
