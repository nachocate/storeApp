import { describe, expect, it } from 'vitest'
import { describePaymentProvider } from './paymentProviders'

describe('describePaymentProvider', () => {
  it('describes known providers', () => {
    expect(describePaymentProvider('CASH').label).toBe('Efectivo')
    expect(describePaymentProvider('TRANSFER').label).toBe('Transferencia')
    expect(describePaymentProvider('MERCADO_PAGO').label).toBe('Mercado Pago')
  })

  it('falls back to the raw code for unknown providers', () => {
    expect(describePaymentProvider('OTHER')).toEqual({ label: 'OTHER', description: '' })
  })
})
