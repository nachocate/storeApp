export const DEFAULT_ADMIN_URL = 'https://admin-dev.tiendario.cloud/'
export const DEFAULT_CONTACT_EMAIL = 'concat.studio.vt@gmail.com'

export const resolveAdminUrl = (configuredUrl) => {
  if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) return DEFAULT_ADMIN_URL

  try {
    const url = new URL(configuredUrl.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.href : DEFAULT_ADMIN_URL
  } catch {
    return DEFAULT_ADMIN_URL
  }
}

export const resolveContactEmail = (configuredEmail) => {
  const email = typeof configuredEmail === 'string' ? configuredEmail.trim() : ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : DEFAULT_CONTACT_EMAIL
}

// FormSubmit accepts either the destination email or the random alias it issues after activation.
export const resolveContactFormId = (configuredId, contactEmail) => {
  const id = typeof configuredId === 'string' ? configuredId.trim() : ''
  return /^[A-Za-z0-9]{8,64}$/.test(id) ? id : contactEmail
}

export const ADMIN_URL = resolveAdminUrl(import.meta.env?.VITE_ADMIN_URL)
export const CONTACT_EMAIL = resolveContactEmail(import.meta.env?.VITE_CONTACT_EMAIL)
export const CONTACT_FORM_ID = resolveContactFormId(import.meta.env?.VITE_CONTACT_FORM_ID, CONTACT_EMAIL)
