export const DEFAULT_ADMIN_URL = 'https://admin-dev.tiendario.cloud/'

export const resolveAdminUrl = (configuredUrl) => {
  if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) return DEFAULT_ADMIN_URL

  try {
    const url = new URL(configuredUrl.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.href : DEFAULT_ADMIN_URL
  } catch {
    return DEFAULT_ADMIN_URL
  }
}

export const ADMIN_URL = resolveAdminUrl(import.meta.env?.VITE_ADMIN_URL)
