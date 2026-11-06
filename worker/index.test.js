import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index.js'

describe('Cloudflare Worker store API proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('forwards a store request to the configured backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"cart":{"revision":2}}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://store.example.com/api/v1/stores/cafe-del-barrio/carts/current?source=web', {
        headers: { 'X-Cart-Token': 'opaque-token' }
      }),
      { API_BASE_URL: 'https://api.example.com/' }
    )

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://api.example.com/api/v1/stores/cafe-del-barrio/carts/current?source=web'),
      expect.objectContaining({ method: 'GET' })
    )
    expect(await response.json()).toEqual({ cart: { revision: 2 } })
  })

  it('logs the upstream endpoint only when proxy logging is enabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await worker.fetch(
      new Request('https://store.example.com/api/v1/stores/modo-dulce/settings?token=private'),
      { API_BASE_URL: 'https://api.example.com/', API_PROXY_LOGGING: 'true' }
    )

    const [message] = consoleLog.mock.calls[0]
    expect(JSON.parse(message)).toMatchObject({
      event: 'store-api-proxy',
      method: 'GET',
      requestPath: '/api/v1/stores/modo-dulce/settings',
      upstream: 'https://api.example.com/api/v1/stores/modo-dulce/settings',
      status: 204
    })
    expect(JSON.parse(message).durationMs).toEqual(expect.any(Number))
  })

  it('returns a clear error when the upstream API URL is missing', async () => {
    const response = await worker.fetch(
      new Request('https://store.example.com/api/v1/stores/modo-dulce/settings'),
      {}
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Store API is not configured' })
  })

  it('forwards vendor inquiries to the backend and relays the empty response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const inquiry = JSON.stringify({ name: 'María', phone: '341 456 7890', email: 'maria@correo.com', message: 'Hola' })

    const response = await worker.fetch(
      new Request('https://tiendario.cloud/api/v1/vendor-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'session=private' },
        body: inquiry
      }),
      { API_BASE_URL: 'https://api.example.com/' }
    )

    const [upstreamUrl, options] = fetchMock.mock.calls[0]
    expect(upstreamUrl.href).toBe('https://api.example.com/api/v1/vendor-inquiries')
    expect(options.method).toBe('POST')
    expect(options.headers.get('content-type')).toBe('application/json')
    expect(options.headers.has('cookie')).toBe(false)
    expect(await new Response(options.body).text()).toBe(inquiry)
    expect(response.status).toBe(204)
  })

  it('rejects vendor inquiry methods other than POST', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://tiendario.cloud/api/v1/vendor-inquiries'),
      { API_BASE_URL: 'https://api.example.com/' }
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('POST')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  const createInquiryRequest = (ip = '203.0.113.7') => new Request('https://tiendario.cloud/api/v1/vendor-inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: '{"name":"María"}'
  })

  it('rate limits vendor inquiries per client IP before reaching the backend', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const limit = vi.fn().mockResolvedValue({ success: false })

    const response = await worker.fetch(createInquiryRequest(), {
      API_BASE_URL: 'https://api.example.com/',
      VENDOR_INQUIRY_RATE_LIMITER: { limit }
    })

    expect(limit).toHaveBeenCalledWith({ key: 'vendor-inquiry:203.0.113.7' })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(await response.json()).toMatchObject({ code: 'rate_limited' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards vendor inquiries within the limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(createInquiryRequest(), {
      API_BASE_URL: 'https://api.example.com/',
      VENDOR_INQUIRY_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) }
    })

    expect(response.status).toBe(204)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('keeps accepting vendor inquiries when the rate limiter fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    const response = await worker.fetch(createInquiryRequest(), {
      API_BASE_URL: 'https://api.example.com/',
      VENDOR_INQUIRY_RATE_LIMITER: { limit: vi.fn().mockRejectedValue(new Error('unavailable')) }
    })

    expect(response.status).toBe(204)
  })
})
