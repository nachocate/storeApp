import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADMIN_URL,
  DEFAULT_CONTACT_EMAIL,
  resolveAdminUrl,
  resolveContactEmail,
  resolveContactFormId
} from './tiendario.js'

describe('resolveAdminUrl', () => {
  it('uses the configured HTTP(S) URL', () => {
    expect(resolveAdminUrl(' https://admin.tiendario.cloud ')).toBe('https://admin.tiendario.cloud/')
  })

  it('falls back to the default for missing or unsafe values', () => {
    expect(resolveAdminUrl()).toBe(DEFAULT_ADMIN_URL)
    expect(resolveAdminUrl('not a url')).toBe(DEFAULT_ADMIN_URL)
    expect(resolveAdminUrl('javascript:alert(1)')).toBe(DEFAULT_ADMIN_URL)
  })
})

describe('resolveContactEmail', () => {
  it('uses a valid configured email', () => {
    expect(resolveContactEmail(' ventas@tiendario.cloud ')).toBe('ventas@tiendario.cloud')
  })

  it('falls back to the default for missing or invalid values', () => {
    expect(resolveContactEmail()).toBe(DEFAULT_CONTACT_EMAIL)
    expect(resolveContactEmail('hola')).toBe(DEFAULT_CONTACT_EMAIL)
  })
})

describe('resolveContactFormId', () => {
  it('uses a configured formsubmit.io token', () => {
    expect(resolveContactFormId(' a1b2c3d4e5f6 ', 'hola@tiendario.cloud')).toBe('a1b2c3d4e5f6')
  })

  it('falls back to the contact email for missing or invalid aliases', () => {
    expect(resolveContactFormId(undefined, 'hola@tiendario.cloud')).toBe('hola@tiendario.cloud')
    expect(resolveContactFormId('../otro', 'hola@tiendario.cloud')).toBe('hola@tiendario.cloud')
  })
})
