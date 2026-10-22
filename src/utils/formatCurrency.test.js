import { afterEach, describe, expect, it } from 'vitest'
import { formatCurrency, setCatalogPrices } from './formatCurrency.js'

const normalize = (text) => text.replace(/\s/g, ' ')

describe('formatCurrency', () => {
  afterEach(() => setCatalogPrices(['0.5']))

  it('keeps cents by default and when any catalog price has cents', () => {
    expect(normalize(formatCurrency(1500))).toBe('$ 1.500,00')
    setCatalogPrices(['1000', '1500.50'])
    expect(normalize(formatCurrency(1500))).toBe('$ 1.500,00')
  })

  it('drops cents everywhere when no catalog price has cents', () => {
    setCatalogPrices(['1000.00', 2500, '15600.00'])
    expect(normalize(formatCurrency(1500))).toBe('$ 1.500')
    expect(normalize(formatCurrency('23220.00'))).toBe('$ 23.220')
  })

  it('still shows cents for derived amounts that have them', () => {
    setCatalogPrices(['1000'])
    expect(normalize(formatCurrency(1234.5))).toBe('$ 1.234,50')
  })
})
