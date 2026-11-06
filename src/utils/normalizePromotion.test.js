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
      { name: 'Alfajor', quantity: '2', unitSymbol: '' },
      { name: 'Budín (Vainilla)', quantity: '1', unitSymbol: '' }
    ])
    expect(fromAmounts.discountPercent).toBe(15)
    expect(fromApi.discountPercent).toBe(12.5)
    expect(normalizePromotions([{ id: 3 }])[0]).toMatchObject({ products: [], discountPercent: null })
  })

  it('shows a fixed discount amount instead of treating it as a percentage or final price', () => {
    const [promotion] = normalizePromotions([{
      id: 5,
      discountType: 'FIXED_PRICE',
      discountValue: '2500.00',
      requirements: [{
        productName: 'Naranja',
        quantity: '1.000',
        unitSymbol: 'kg'
      }]
    }])

    expect(promotion).toMatchObject({
      discountPercent: null,
      discountAmount: '2500.00',
      totalAmount: null,
      products: [{ name: 'Naranja', quantity: '1', unitSymbol: 'kg' }]
    })
  })

  it('uses the API discount value for percentage promotions', () => {
    const [promotion] = normalizePromotions([{
      id: 6,
      discountType: 'PERCENTAGE',
      discountValue: '12.5'
    }])

    expect(promotion.discountPercent).toBe(12.5)
  })

  it('normalizes a fixed-amount discount without turning it into a fixed bundle price', () => {
    const [promotion] = normalizePromotions([{
      id: 7,
      name: 'Promo Con Frio',
      description: 'Llevando 2 Arandanos y 1 Frutos de Bosque tenes un descuento de $2000',
      discountType: 'FIXED_AMOUNT',
      bundleDiscountAmount: '0.00',
      discountValue: '2000.00',
      requirements: [
        { productName: 'Arandanos x Bolsa', quantity: '2.000', unitSymbol: 'u' },
        { productName: 'Frutos Rojos x Bolsa', quantity: '1.000', unitSymbol: 'u' }
      ]
    }])

    expect(promotion).toMatchObject({
      name: 'Promo Con Frio',
      discountPercent: null,
      discountAmount: '2000.00',
      totalAmount: null,
      products: [
        { name: 'Arandanos x Bolsa', quantity: '2', unitSymbol: 'u' },
        { name: 'Frutos Rojos x Bolsa', quantity: '1', unitSymbol: 'u' }
      ]
    })
  })

  it('does not derive a percentage from the amounts of a fixed-amount promotion', () => {
    const [promotion] = normalizePromotions([{
      id: 3,
      discountType: 'FIXED_AMOUNT',
      discountValue: '2000.00',
      bundleOriginalAmount: '12600.00',
      bundleDiscountAmount: '2000.00',
      bundleTotalAmount: '10600.00'
    }])

    expect(promotion).toMatchObject({
      discountPercent: null,
      discountAmount: '2000.00',
      totalAmount: '10600.00'
    })
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
