import { createApp, nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { afterEach, describe, expect, it } from 'vitest'
import ContactPage from './ContactPage.vue'

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
}

afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
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
  })

  it('keeps the entered data and confirms when the request is valid', async () => {
    const container = render()

    await fill(container, 'name', 'Ana Pérez')
    await fill(container, 'phone', '11 1234 5678')
    await fill(container, 'email', 'ana@correo.com')
    await fill(container, 'message', 'Tengo una librería en el centro.')
    await submit(container)

    expect(container.querySelectorAll('.contact-field-error')).toHaveLength(0)
    expect(container.querySelector('.contact-status').textContent).toContain('hola@tiendario.cloud')
    expect(container.querySelector('#contact-name').value).toBe('Ana Pérez')
  })
})
