import { describe, expect, it } from 'vitest'
import {
  createEmptyContactRequest,
  validateContactField,
  validateContactRequest
} from './contactRequest.js'

const validRequest = {
  name: 'Ana Pérez',
  phone: '+54 9 11 1234-5678',
  email: 'ana@correo.com',
  message: 'Tengo una librería y quiero vender online.'
}

describe('validateContactRequest', () => {
  it('requires every field', () => {
    expect(Object.keys(validateContactRequest(createEmptyContactRequest())))
      .toEqual(['name', 'phone', 'email', 'message'])
  })

  it('accepts a complete request', () => {
    expect(validateContactRequest(validRequest)).toEqual({})
  })

  it('rejects invalid formats and lengths', () => {
    expect(validateContactField('phone', 'abc 1234')).toContain('números')
    expect(validateContactField('phone', '1234')).toContain('8 dígitos')
    expect(validateContactField('email', 'ana@correo')).toContain('correo válido')
    expect(validateContactField('message', 'Hola')).toContain('al menos 10')
    expect(validateContactField('name', 'a'.repeat(81))).toContain('hasta 80')
  })

  it('ignores surrounding whitespace', () => {
    expect(validateContactField('name', '   ')).toBe('Ingresá tu nombre.')
  })
})
