import { describe, expect, it } from 'vitest'
import { formatOrderStatus } from './formatOrderStatus.js'

describe('formatOrderStatus', () => {
  it('translates known order statuses into Spanish', () => {
    expect(formatOrderStatus('AWAITING_PAYMENT_PROOF')).toBe('A la espera del comprobante')
    expect(formatOrderStatus('PAYMENT_PROOF_UNDER_REVIEW')).toBe('Comprobante en revisión')
    expect(formatOrderStatus('OUT_FOR_DELIVERY')).toBe('En camino')
    expect(formatOrderStatus('READY_FOR_DISPATCH')).toBe('Listo para despachar')
    expect(formatOrderStatus('COMPLETED')).toBe('Completado')
  })

  it('normalizes lowercase and space-separated status values', () => {
    expect(formatOrderStatus('out for delivery')).toBe('En camino')
  })

  it('shows an unknown API status without translating it', () => {
    expect(formatOrderStatus('NEW_BACKEND_STATE')).toBe('NEW_BACKEND_STATE')
  })

  it('provides a localized fallback for a missing status', () => {
    expect(formatOrderStatus(null)).toBe('Estado no disponible')
  })
})