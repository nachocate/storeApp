import { describe, expect, it } from 'vitest'
import { isValidCustomerPhone } from './customerPhone.js'

describe('isValidCustomerPhone', () => {
  it('accepts international phone formats with common separators', () => {
    expect(isValidCustomerPhone('+54 9 341 555 0100')).toBe(true)
    expect(isValidCustomerPhone('(0341) 555-0100')).toBe(true)
  })

  it('rejects missing, malformed, and out-of-range phone numbers', () => {
    expect(isValidCustomerPhone('')).toBe(false)
    expect(isValidCustomerPhone('1234567')).toBe(false)
    expect(isValidCustomerPhone('+54 9 341 555 0100 ext 2')).toBe(false)
    expect(isValidCustomerPhone('1234567890123456')).toBe(false)
  })
})
