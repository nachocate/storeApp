import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './vendorInquiryProxy.js'

const createResponse = () => ({
  headers: {},
  statusCode: null,
  body: undefined,
  status(code) {
    this.statusCode = code
    return this
  },
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value
  },
  json(body) {
    this.body = body
    return this
  },
  send(body) {
    this.body = body
    return this
  },
  end() {
    this.body = null
    return this
  }
})

const inquiry = { name: 'María', phone: '341 456 7890', email: 'maria@correo.com', message: 'Hola' }

describe('Vercel vendor inquiry proxy', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('forwards the inquiry to the backend and relays 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204, headers: new Headers() })
    vi.stubGlobal('fetch', fetchMock)
    const response = createResponse()

    await handler({
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'session=private' },
      body: inquiry
    }, response)

    const [upstreamUrl, options] = fetchMock.mock.calls[0]
    expect(upstreamUrl.pathname).toBe('/api/v1/vendor-inquiries')
    expect(options.method).toBe('POST')
    expect(options.headers).not.toHaveProperty('cookie')
    expect(options.body).toBe(JSON.stringify(inquiry))
    expect(response.statusCode).toBe(204)
  })

  it('relays validation errors from the backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 422,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => '{"code":"invalid_vendor_inquiry"}'
    }))
    const response = createResponse()

    await handler({ method: 'POST', headers: {}, body: inquiry }, response)

    expect(response.statusCode).toBe(422)
    expect(response.body).toBe('{"code":"invalid_vendor_inquiry"}')
  })

  it('rejects other methods and unreachable backends', async () => {
    const methodResponse = createResponse()
    await handler({ method: 'GET', headers: {} }, methodResponse)
    expect(methodResponse.statusCode).toBe(405)
    expect(methodResponse.headers.allow).toBe('POST')

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const unreachableResponse = createResponse()
    await handler({ method: 'POST', headers: {}, body: inquiry }, unreachableResponse)
    expect(unreachableResponse.statusCode).toBe(502)
  })
})
