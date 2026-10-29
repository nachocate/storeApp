const FORMSUBMIT_BASE_URL = 'https://formsubmit.io/send/'
const SUCCESS_PATH = '/contacto-enviado'
const REQUEST_TIMEOUT_MS = 20000

export class ContactRequestError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ContactRequestError'
  }
}

export const buildContactFields = (request, successUrl) => ({
  name: request.name.trim(),
  phone: request.phone.trim(),
  email: request.email.trim(),
  message: request.message.trim(),
  _redirect: successUrl
})

const readFrameLocation = (frame) => {
  try {
    return frame.contentWindow?.location?.href ?? ''
  } catch {
    // Cross-origin: FormSubmit redirected to its own error or confirmation page.
    return null
  }
}

const isSuccessLocation = (href, origin) => {
  try {
    const url = new URL(href)
    return url.origin === origin && url.pathname.startsWith(SUCCESS_PATH)
  } catch {
    return false
  }
}

/*
 * formsubmit.io only accepts classic form posts and reports the outcome through redirects,
 * so the form is posted into a hidden iframe whose final location reveals the result.
 */
export const sendContactRequest = (request, formId, { doc = document, timeoutMs = REQUEST_TIMEOUT_MS } = {}) =>
  new Promise((resolve, reject) => {
    const origin = doc.defaultView.location.origin
    const frameName = `contact-frame-${Date.now()}`
    const frame = doc.createElement('iframe')
    const form = doc.createElement('form')
    let submitted = false
    let timeoutId

    const cleanup = () => {
      clearTimeout(timeoutId)
      frame.remove()
      form.remove()
    }

    const finish = (error) => {
      cleanup()
      if (error) reject(error)
      else resolve()
    }

    frame.name = frameName
    frame.title = 'Envío de la consulta'
    frame.hidden = true
    frame.setAttribute('aria-hidden', 'true')
    frame.addEventListener('load', () => {
      if (!submitted) return
      const href = readFrameLocation(frame)
      if (href === 'about:blank' || href === '') return
      if (href && isSuccessLocation(href, origin)) finish()
      else finish(new ContactRequestError('El servicio de contacto rechazó la consulta.'))
    })

    form.method = 'POST'
    form.action = `${FORMSUBMIT_BASE_URL}${encodeURIComponent(formId)}`
    form.target = frameName
    form.hidden = true
    Object.entries(buildContactFields(request, `${origin}${SUCCESS_PATH}.html`)).forEach(([name, value]) => {
      const input = doc.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.append(input)
    })

    doc.body.append(frame, form)
    timeoutId = setTimeout(
      () => finish(new ContactRequestError('El servicio de contacto no respondió a tiempo.')),
      timeoutMs
    )
    submitted = true
    form.submit()
  })
