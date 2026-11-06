import { describe, expect, it } from 'vitest'
import { resolveStoreAssetUrl } from './resolveStoreAssetUrl.js'

describe('resolveStoreAssetUrl', () => {
  const apiBaseUrl = 'https://api.example.com'

  it('resolves root-relative API media URLs against the configured API host', () => {
    expect(resolveStoreAssetUrl('/media/stores/logo.png', apiBaseUrl))
      .toBe(`${apiBaseUrl}/media/stores/logo.png`)
  })

  it('resolves path-relative API media URLs against the configured API host', () => {
    expect(resolveStoreAssetUrl('media/products/item.png', apiBaseUrl))
      .toBe(`${apiBaseUrl}/media/products/item.png`)
  })

  it('preserves absolute URLs and rejects empty or unsupported URLs', () => {
    expect(resolveStoreAssetUrl('https://cdn.example.com/logo.png'))
      .toBe('https://cdn.example.com/logo.png')
    expect(resolveStoreAssetUrl('data:image/png;base64,abc'))
      .toBe('data:image/png;base64,abc')
    expect(resolveStoreAssetUrl('')).toBe('')
    expect(resolveStoreAssetUrl('javascript:alert(1)')).toBe('')
  })
})
