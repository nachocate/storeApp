import { describe, expect, it } from 'vitest'
import {
  buildContactMailto,
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

describe('buildContactMailto', () => {
  it('encodes the request as a mail draft for the configured recipient', () => {
    const mailto = buildContactMailto({ ...validRequest, name: ' Ana Pérez ' }, 'hola@tiendario.cloud')
    const url = new URL(mailto)

    expect(url.protocol).toBe('mailto:')
    expect(url.pathname).toBe('hola@tiendario.cloud')
    expect(mailto).not.toContain('+')
    expect(url.searchParams.get('subject')).toBe('Quiero ser parte de Tiendario - Ana Pérez')
    expect(url.searchParams.get('body')).toBe([
      'Nombre: Ana Pérez',
      'Teléfono: +54 9 11 1234-5678',
      'Correo: ana@correo.com',
      '',
      'Tengo una librería y quiero vender online.'
    ].join('\n'))
  })
})
