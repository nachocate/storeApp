import { describe, expect, it } from 'vitest'
import { DEFAULT_ADMIN_URL, resolveAdminUrl } from './tiendario.js'

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
