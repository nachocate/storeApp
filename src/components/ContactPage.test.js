import { createApp, nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ContactPage from './ContactPage.vue'
import { submitVendorInquiry } from '../api/vendorInquiries.js'

vi.mock('../api/vendorInquiries.js', async (importOriginal) => ({
  ...(await importOriginal()),
  submitVendorInquiry: vi.fn()
}))

let app

const render = () => {
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp(ContactPage)
  app.use(PrimeVue, { unstyled: true })
  app.component('Button', Button)
  app.component('InputText', InputText)
  app.component('Message', Message)
  app.component('Textarea', Textarea)
  app.mount(container)
  return container
}

const fill = async (container, field, value) => {
  const input = container.querySelector(`#contact-${field}`)
  input.value = value
  input.dispatchEvent(new Event('input'))
  await nextTick()
}

const submit = async (container) => {
  container.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }))
  await nextTick()
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
  await nextTick()
}

const fillValidRequest = async (container) => {
  await fill(container, 'name', 'Ana Pérez')
  await fill(container, 'phone', '11 1234 5678')
  await fill(container, 'email', 'ana@correo.com')
  await fill(container, 'message', 'Tengo una librería en el centro.')
}

afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('ContactPage', () => {
  it('shows the plan information and the contact form', () => {
    const container = render()

    expect(container.querySelector('h1').textContent).toContain('Tu tienda online')
    expect(container.querySelectorAll('.plan-features li').length).toBeGreaterThan(0)
    for (const field of ['name', 'phone', 'email', 'message']) {
      expect(container.querySelector(`label[for="contact-${field}"]`)).not.toBeNull()
    }
  })

  it('does not show errors before the user interacts with the form', () => {
    const container = render()

    expect(container.querySelectorAll('.contact-field-error')).toHaveLength(0)
  })

  it('shows accessible errors and focuses the first invalid field on submit', async () => {
    const container = render()

    await submit(container)

    const nameInput = container.querySelector('#contact-name')
    expect(container.querySelectorAll('.contact-field-error')).toHaveLength(4)
    expect(nameInput.getAttribute('aria-invalid')).toBe('true')
    expect(nameInput.getAttribute('aria-describedby')).toBe('contact-name-error')
    expect(document.activeElement).toBe(nameInput)
    expect(submitVendorInquiry).not.toHaveBeenCalled()
  })

  it('sends a valid request and clears the form', async () => {
    submitVendorInquiry.mockResolvedValue(null)
    const container = render()

    await fillValidRequest(container)
    await submit(container)

    expect(submitVendorInquiry).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana Pérez', email: 'ana@correo.com' })
    )
    expect(container.querySelector('.contact-status').textContent).toContain('Recibimos tu consulta')
    expect(container.querySelector('#contact-name').value).toBe('')
    expect(container.querySelectorAll('.contact-field-error')).toHaveLength(0)
  })

  it('keeps the entered data and shows a safe message when the API fails', async () => {
    submitVendorInquiry.mockRejectedValue(Object.assign(new Error('Service unavailable'), { status: 503 }))
    const container = render()

    await fillValidRequest(container)
    await submit(container)

    const status = container.querySelector('.contact-status')
    expect(status.getAttribute('role')).toBe('alert')
    expect(status.textContent).toContain('Intentá de nuevo en unos minutos')
    expect(status.textContent).not.toContain('Service unavailable')
    expect(container.querySelector('#contact-name').value).toBe('Ana Pérez')
  })

  it('does not send requests flagged by the honeypot', async () => {
    const container = render()

    await fillValidRequest(container)
    await fill(container, 'honey', 'spam')
    await submit(container)

    expect(submitVendorInquiry).not.toHaveBeenCalled()
    expect(container.querySelector('.contact-status').textContent).toContain('Recibimos tu consulta')
  })
})
