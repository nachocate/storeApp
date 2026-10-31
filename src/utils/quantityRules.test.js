import { describe, expect, it } from 'vitest'
import { formatQuantity, readQuantityRules, roundQuantity } from './quantityRules.js'

describe('quantityRules', () => {
  it('reads minimum and increment from the API product', () => {
    expect(readQuantityRules({
      unit: { name: 'Kilogramo', symbol: 'kg', decimalScale: 3 },
      minimumPurchaseQuantity: '0.500',
      quantityIncrement: '0.250'
    })).toMatchObject({ minQuantity: 0.5, step: 0.25, unitSymbol: 'kg', decimalScale: 3 })
  })

  it('uses the increment as minimum when the API omits it', () => {
    expect(readQuantityRules({ unit: { symbol: 'l', decimalScale: 2 }, quantityIncrement: '0.5' }))
      .toMatchObject({ minQuantity: 0.5, step: 0.5 })
  })

  it('falls back to whole units without unit data', () => {
    expect(readQuantityRules({})).toMatchObject({ minQuantity: 1, step: 1, unitSymbol: 'u', decimalScale: 0 })
  })

  it('uses sale units and whole quantities for products priced by kg', () => {
    expect(readQuantityRules({
      pricingMode: 'WEIGHT_BASED_UNIT_PRICE',
      unit: { symbol: 'kg', decimalScale: 3 },
      saleUnit: { symbol: 'u', decimalScale: 0 },
      minimumPurchaseQuantity: '1',
      quantityIncrement: '1'
    })).toMatchObject({ minQuantity: 1, step: 1, unitSymbol: 'u', decimalScale: 0 })
  })

  it('formats quantities with the product unit', () => {
    expect(formatQuantity(0.5, { unitSymbol: 'kg', decimalScale: 3 })).toBe('500 g')
    expect(formatQuantity(1.5, { unitSymbol: 'kg', decimalScale: 3 })).toBe('1.5 kg')
    expect(formatQuantity(2.25, { unitSymbol: 'm', decimalScale: 2 })).toBe('2.25 m')
    expect(formatQuantity(3, { unitSymbol: 'u', decimalScale: 0 })).toBe('3 u')
  })

  it('rounds to the unit scale', () => {
    expect(roundQuantity(0.1 + 0.2, 3)).toBe(0.3)
  })
})
