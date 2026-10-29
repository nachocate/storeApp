import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactRequestError, buildContactFields, sendContactRequest } from './contactService.js'

const request = {
  name: ' Ana Pérez ',
  phone: '11 1234 5678',
  email: 'ana@correo.com',
  message: 'Tengo una librería en el centro.'
}

const simulateFrameLoad = (location) => {
  const frame = document.querySelector('iframe')
  Object.defineProperty(frame, 'contentWindow', {
    configurable: true,
    get: () => (location instanceof Error
      ? { get location() { throw location } }
      : { location: { href: location } })
  })
  frame.dispatchEvent(new Event('load'))
}

describe('contactService', () => {
  let submitSpy

  beforeEach(() => {
    submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})
  })

  afterEach(() => {
    submitSpy.mockRestore()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('builds trimmed fields with the success redirect', () => {
    expect(buildContactFields(request, 'https://tiendario.cloud/ok')).toEqual({
      name: 'Ana Pérez',
      phone: '11 1234 5678',
      email: 'ana@correo.com',
      message: 'Tengo una librería en el centro.',
      _redirect: 'https://tiendario.cloud/ok'
    })
  })

  it('posts the fields to formsubmit.io into a hidden frame', () => {
    sendContactRequest(request, 'hola@tiendario.cloud').catch(() => {})

    const form = document.querySelector('form')
    expect(form.action).toBe('https://formsubmit.io/send/hola%40tiendario.cloud')
    expect(form.method.toLowerCase()).toBe('post')
    expect(form.target).toBe(document.querySelector('iframe').name)
    expect(form.querySelector('[name="_redirect"]').value).toBe(`${window.location.origin}/contacto-enviado.html`)
    expect(submitSpy).toHaveBeenCalledOnce()
  })

  it('resolves and cleans up when the frame lands on the success page', async () => {
    const pending = sendContactRequest(request, 'abc12345')

    simulateFrameLoad('about:blank')
    simulateFrameLoad(`${window.location.origin}/contacto-enviado`)

    await expect(pending).resolves.toBeUndefined()
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.querySelector('form')).toBeNull()
  })

  it('rejects when FormSubmit redirects to its own page', async () => {
    const pending = sendContactRequest(request, 'abc12345')

    simulateFrameLoad(new DOMException('Blocked a frame', 'SecurityError'))

    await expect(pending).rejects.toBeInstanceOf(ContactRequestError)
  })

  it('rejects when the service does not respond in time', async () => {
    vi.useFakeTimers()
    const pending = sendContactRequest(request, 'abc12345', { timeoutMs: 1000 })

    vi.advanceTimersByTime(1000)

    await expect(pending).rejects.toBeInstanceOf(ContactRequestError)
  })
})
