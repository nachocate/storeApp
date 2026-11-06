import { describe, expect, it } from 'vitest'
import { formatDeliveryAddress } from './formatDeliveryAddress.js'

describe('formatDeliveryAddress', () => {
  it('combines address, locality, and delivery notes into one string', () => {
    expect(formatDeliveryAddress({
      address: '56uwy',
      locality: 'wh645',
      notes: 'wh456'
    })).toBe('56uwy, wh645, wh456')
  })

  it('omits empty optional parts', () => {
    expect(formatDeliveryAddress({ address: 'Calle 1', locality: 'Centro', notes: '  ' }))
      .toBe('Calle 1, Centro')
  })
})