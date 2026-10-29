import { describe, expect, it, vi } from 'vitest'
import { ContactRequestError, buildContactPayload, sendContactRequest } from './contactService.js'

const request = {
  name: ' Ana Pérez ',
  phone: '11 1234 5678',
  email: 'ana@correo.com',
  message: 'Tengo una librería en el centro.'
}

const jsonResponse = (data, ok = true) => ({ ok, json: async () => data })

describe('contactService', () => {
  it('builds a trimmed payload with the FormSubmit options', () => {
    expect(buildContactPayload(request)).toMatchObject({
      name: 'Ana Pérez',
      email: 'ana@correo.com',
      _subject: 'Quiero ser parte de Tiendario - Ana Pérez',
      _template: 'table'
    })
  })

  it('posts the request as JSON to the FormSubmit endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: 'true' }))

    await sendContactRequest(request, 'hola@tiendario.cloud', { fetchImpl })

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://formsubmit.co/ajax/hola%40tiendario.cloud')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body).message).toBe(request.message)
  })

  it('rejects when the service reports a failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: 'false', message: 'needs activation' }))

    await expect(sendContactRequest(request, 'abc12345', { fetchImpl })).rejects.toBeInstanceOf(ContactRequestError)
  })

  it('rejects on HTTP and network errors', async () => {
    await expect(sendContactRequest(request, 'abc12345', {
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(null, false))
    })).rejects.toBeInstanceOf(ContactRequestError)

    await expect(sendContactRequest(request, 'abc12345', {
      fetchImpl: vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    })).rejects.toBeInstanceOf(ContactRequestError)
  })
})
