import { describe, expect, it } from 'vitest'
import { normalizeOrderItems, readOrderItems, snapshotOrderItems } from './orderItems.js'

describe('orderItems', () => {
  it('normalizes product names, variants, quantities and units from checkout items', () => {
    expect(snapshotOrderItems([{
      id: 'coffee',
      name: 'Café',
      variantLabel: 'Molido',
      quantity: 0.5,
      unit: { symbol: 'kg', decimalScale: 3 }
    }])).toEqual([{
      name: 'Café',
      variantLabel: 'Molido',
      quantity: 0.5,
      unitSymbol: 'kg',
      decimalScale: 3
    }])
  })

  it('accepts order item shapes returned by the tracking API', () => {
    expect(readOrderItems({
      orderItems: [{
        product: { name: 'Yerba', unit: { symbol: 'kg' } },
        variant: { name: 'Suave' },
        quantity: '1.000'
      }]
    })).toEqual([{
      name: 'Yerba',
      variantLabel: 'Suave',
      quantity: 1,
      unitSymbol: 'kg',
      decimalScale: 0
    }])
  })

  it('ignores invalid lines and unsupported payloads', () => {
    expect(normalizeOrderItems([
      { name: 'Sin cantidad' },
      { name: 'Cantidad inválida', quantity: 'x' },
      { name: 'Producto', quantity: 2 }
    ])).toEqual([{
      name: 'Producto',
      variantLabel: '',
      quantity: 2,
      unitSymbol: 'u',
      decimalScale: 0
    }])
    expect(readOrderItems({})).toEqual([])
  })
})
