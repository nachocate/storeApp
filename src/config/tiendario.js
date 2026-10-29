export const DEFAULT_ADMIN_URL = 'https://admin-dev.tiendario.cloud/'
export const DEFAULT_CONTACT_EMAIL = 'hola@tiendario.cloud'

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

export const ADMIN_URL = resolveAdminUrl(import.meta.env?.VITE_ADMIN_URL)
export const CONTACT_EMAIL = resolveContactEmail(import.meta.env?.VITE_CONTACT_EMAIL)
