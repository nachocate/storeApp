import { describe, expect, it } from 'vitest'
import {
  buildFallbackTimeline,
  getCurrentStepIndex,
  getStatusMessage,
  getStatusTone,
  isWaitingStatus,
  normalizeStatusTimeline
} from './orderStatusStyles.js'

describe('orderStatusStyles', () => {
  it('maps statuses to tones with a neutral fallback', () => {
    expect(getStatusTone('CONFIRMED')).toBe('success')
    expect(getStatusTone('payment-proof-under-review')).toBe('info')
    expect(getStatusTone('CANCELLED')).toBe('danger')
    expect(getStatusTone('UNKNOWN')).toBe('neutral')
  })

  it('identifies statuses where the store may take a while', () => {
    expect(isWaitingStatus('PENDING_AVAILABILITY')).toBe(true)
    expect(isWaitingStatus('PREPARING')).toBe(false)
    expect(getStatusMessage('PENDING_AVAILABILITY')).toContain('demorar')
    expect(getStatusMessage('OTHER')).toBe('')
  })

  it('normalizes the API timeline and drops invalid steps', () => {
    expect(normalizeStatusTimeline(undefined)).toBeUndefined()
    expect(normalizeStatusTimeline([{ code: 'X', state: 'WRONG' }])).toBeUndefined()
    expect(normalizeStatusTimeline([
      { code: 'A', label: 'Paso A', state: 'COMPLETED', extra: true },
      { code: 'B', state: 'CURRENT' }
    ])).toEqual([
      { code: 'A', label: 'Paso A', state: 'COMPLETED' },
      { code: 'B', label: 'B', state: 'CURRENT' }
    ])
  })

  it('builds the full fallback route per payment and fulfillment type', () => {
    const route = buildFallbackTimeline({
      status: 'PAYMENT_PROOF_UNDER_REVIEW',
      fulfillmentType: 'DELIVERY',
      paymentProvider: 'TRANSFER'
    })

    expect(route.map((step) => step.code)).toEqual([
      'PENDING_AVAILABILITY', 'AWAITING_PAYMENT_PROOF', 'PAYMENT_PROOF_UNDER_REVIEW', 'CONFIRMED',
      'PREPARING', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'COMPLETED'
    ])
    expect(route.map((step) => step.state).slice(0, 4)).toEqual(['COMPLETED', 'COMPLETED', 'CURRENT', 'UPCOMING'])
    expect(buildFallbackTimeline({ status: 'MYSTERY' })).toHaveLength(1)
  })

  it('finds the current step', () => {
    expect(getCurrentStepIndex([
      { code: 'A', label: 'A', state: 'COMPLETED' },
      { code: 'B', label: 'B', state: 'CURRENT' },
      { code: 'C', label: 'C', state: 'UPCOMING' }
    ])).toBe(1)
    expect(getCurrentStepIndex([
      { code: 'A', label: 'A', state: 'COMPLETED' },
      { code: 'B', label: 'B', state: 'COMPLETED' }
    ])).toBe(1)
  })
})
