import { describe, expect, it } from 'vitest'
import { normalizeFulfillmentWindowId } from './normalizeFulfillmentWindowId.js'

describe('normalizeFulfillmentWindowId', () => {
  it('keeps numeric identifiers as numbers', () => {
    expect(normalizeFulfillmentWindowId('42')).toBe(42)
  })

  it('preserves non-numeric identifiers as strings', () => {
    expect(normalizeFulfillmentWindowId('window-abc')).toBe('window-abc')
  })

  it('preserves numeric strings outside the safe integer range', () => {
    expect(normalizeFulfillmentWindowId('9007199254740992')).toBe('9007199254740992')
  })
})