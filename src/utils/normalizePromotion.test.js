import { describe, expect, it } from 'vitest'
import { getBundleErrorMessage, normalizePromotions } from './normalizePromotion.js'

describe('normalizePromotions', () => {
  it('returns an empty list for missing or invalid payloads', () => {
    expect(normalizePromotions(undefined)).toEqual([])
    expect(normalizePromotions({})).toEqual([])
    expect(normalizePromotions([{ name: 'Sin id' }])).toEqual([])
  })

  it('keeps API amounts as strings and reads bundleAddable strictly', () => {
    const [promotion] = normalizePromotions({
      promotions: [{
        id: 7,
        name: ' Combo ',
        imageUrl: null,
        bundleAddable: true,
        bundleOriginalAmount: '1000.00',
        bundleDiscountAmount: '100.00',
        bundleTotalAmount: '900.00'
      }]
    })

    expect(promotion).toMatchObject({
      id: 7,
      name: 'Combo',
      bundleAddable: true,
      originalAmount: '1000.00',
      discountAmount: '100.00',
      totalAmount: '900.00'
    })
    expect(normalizePromotions([{ id: 1 }])[0].bundleAddable).toBe(false)
  })

  it('lists the included products and exposes the discount percentage', () => {
    const [fromAmounts, fromApi] = normalizePromotions([
      {
        id: 1,
        bundleOriginalAmount: '1000.00',
        bundleDiscountAmount: '150.00',
        requirements: [
          { quantity: '2.000', product: { name: 'Alfajor' } },
          { quantity: '1.000', productName: 'Budín', variantName: 'Vainilla' },
          { quantity: '1.000' }
        ]
      },
      { id: 2, discountPercentage: '12.5', bundleOriginalAmount: '1000.00', bundleDiscountAmount: '0.00' }
    ])

    expect(fromAmounts.products).toEqual([
      { name: 'Alfajor', quantity: '2' },
      { name: 'Budín (Vainilla)', quantity: '1' }
    ])
    expect(fromAmounts.discountPercent).toBe(15)
    expect(fromApi.discountPercent).toBe(12.5)
    expect(normalizePromotions([{ id: 3 }])[0]).toMatchObject({ products: [], discountPercent: null })
  })

  it('falls back to the first requirement image when imageUrl is null', () => {
    const [promotion] = normalizePromotions([{
      id: 1,
      imageUrl: null,
      requirements: [{ product: { imageUrls: [] } }, { product: { imageUrls: ['https://cdn.test/a.png'] } }]
    }])
    expect(promotion.image).toContain('a.png')
  })
})

describe('getBundleErrorMessage', () => {
  it('maps known codes and falls back to a generic message', () => {
    expect(getBundleErrorMessage({ code: 'promotion_not_available' })).toMatch(/venció/)
    expect(getBundleErrorMessage({ code: 'other' })).toMatch(/No se pudo/)
  })
})
