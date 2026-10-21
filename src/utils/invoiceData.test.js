import { describe, expect, it } from 'vitest'
import { buildInvoiceData, isValidEmail, resolveInvoiceMode, validateInvoiceData } from './invoiceData.js'

const valid = { legalName: '  María Pérez ', documentType: 'DNI', documentNumber: '35.123.456' }

describe('invoiceData', () => {
  it('treats missing or unknown modes as disabled', () => {
    expect(resolveInvoiceMode({})).toBe('DISABLED')
    expect(resolveInvoiceMode({ customerInvoiceDataMode: 'NOPE' })).toBe('DISABLED')
    expect(resolveInvoiceMode({ customerInvoiceDataMode: 'REQUIRED' })).toBe('REQUIRED')
  })

  it('normalizes valid data to trimmed name and digits only', () => {
    expect(validateInvoiceData(valid).data).toEqual({
      legalName: 'María Pérez', documentType: 'DNI', documentNumber: '35123456'
    })
  })

  it('validates document length by type', () => {
    expect(validateInvoiceData({ ...valid, documentNumber: '123' }).errors.documentNumber).toBeTruthy()
    expect(validateInvoiceData({ ...valid, documentType: 'CUIT', documentNumber: '20-35123456-7' }).data).not.toBeNull()
    expect(validateInvoiceData({ ...valid, legalName: ' ' }).errors.legalName).toBeTruthy()
  })

  it('omits invoice data unless the mode and choice require it', () => {
    expect(buildInvoiceData('DISABLED', true, valid)).toBeUndefined()
    expect(buildInvoiceData('OPTIONAL', false, valid)).toBeUndefined()
    expect(buildInvoiceData('OPTIONAL', true, valid)).toBeDefined()
    expect(buildInvoiceData('REQUIRED', false, valid)).toBeDefined()
    expect(buildInvoiceData('REQUIRED', false, { ...valid, legalName: '' })).toBeUndefined()
  })

  it('validates email format', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})
