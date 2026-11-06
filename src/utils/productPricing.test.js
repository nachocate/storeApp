import { describe, expect, it } from 'vitest'
import {
  formatEstimatedWeight,
  formatMainPrice,
  formatWeightHint,
  getEffectiveUnitPrice
} from './productPricing.js'

const pepper = {
  currency: 'ARS',
  pricingMode: 'WEIGHT_BASED_UNIT_PRICE',
  unit: { symbol: 'kg', decimalScale: 3 },
  saleUnit: { symbol: 'u', decimalScale: 0 },
  pricePerUnit: '4000.00',
  effectiveUnitPrice: '800.00',
  estimatedUnitWeightKg: '0.200'
}

describe('productPricing', () => {
  it('uses the effective unit price and retains kg only as contextual information', () => {
    expect(getEffectiveUnitPrice(pepper)).toBe(800)
    expect(formatMainPrice(pepper)).toMatch(/800.*por u/)
    expect(formatWeightHint(pepper)).toMatch(/4.?000.*kg.*200 g aprox. por u/)
  })

  it('uses the selected variant price for weighted variants', () => {
    expect(getEffectiveUnitPrice(pepper, { pricePerUnit: '3000.00' })).toBe(3000)
    expect(formatEstimatedWeight('2.000')).toBe('2 kg')
  })
})
