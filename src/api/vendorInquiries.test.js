import { afterEach, describe, expect, it, vi } from 'vitest'
import { getVendorInquiryErrorMessage, submitVendorInquiry } from './vendorInquiries.js'

const request = {
  name: ' María González ',
  phone: '+54 9 11 1234-5678',
  email: ' maria@almacenluna.com ',
  message: ' Vendo productos regionales en Rosario. '
}

describe('submitVendorInquiry', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts the trimmed inquiry as JSON and resolves on 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))

    await expect(submitVendorInquiry(request)).resolves.toBeNull()

    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/vendor-inquiries')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({
      name: 'María González',
      phone: '+54 9 11 1234-5678',
      email: 'maria@almacenluna.com',
      message: 'Vendo productos regionales en Rosario.'
    })
  })

  it('rejects with the API status and code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ code: 'invalid_vendor_inquiry', message: 'Invalid format' })
    }))

    await expect(submitVendorInquiry(request)).rejects.toMatchObject({
      status: 422,
      code: 'invalid_vendor_inquiry'
    })
  })
})

describe('getVendorInquiryErrorMessage', () => {
  it('maps validation, service and network errors to safe messages', () => {
    expect(getVendorInquiryErrorMessage({ status: 429 })).toContain('Esperá un minuto')
    expect(getVendorInquiryErrorMessage({ status: 422 })).toContain('Revisá los datos')
    expect(getVendorInquiryErrorMessage({ status: 400 })).toContain('Revisá los datos')
    expect(getVendorInquiryErrorMessage({ status: 503 })).toContain('en unos minutos')
    expect(getVendorInquiryErrorMessage(new TypeError('Failed to fetch'))).toContain('Revisá tu conexión')
  })
})
