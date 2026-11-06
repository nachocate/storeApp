import { describe, expect, it } from 'vitest'
import { canUploadTransferProof } from './canUploadTransferProof.js'

describe('canUploadTransferProof', () => {
  it('allows transfer orders awaiting payment proof', () => {
    expect(canUploadTransferProof({
      paymentProvider: 'TRANSFER',
      orderStatus: 'AWAITING_PAYMENT_PROOF'
    })).toBe(true)
  })

  it('supports the previous pending-payment status and human-readable variants', () => {
    expect(canUploadTransferProof({
      paymentProvider: 'TRANSFER',
      status: 'awaiting payment proof'
    })).toBe(true)
    expect(canUploadTransferProof({
      paymentProvider: 'TRANSFER',
      orderStatus: 'PENDING_PAYMENT'
    })).toBe(true)
  })

  it('does not allow proof uploads for other payment methods or states', () => {
    expect(canUploadTransferProof({
      paymentProvider: 'CASH',
      orderStatus: 'AWAITING_PAYMENT_PROOF'
    })).toBe(false)
    expect(canUploadTransferProof({
      paymentProvider: 'TRANSFER',
      orderStatus: 'CONFIRMED'
    })).toBe(false)
  })
})