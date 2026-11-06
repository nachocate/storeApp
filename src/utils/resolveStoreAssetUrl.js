import { API_BASE_URL } from '../config/store.js'

const supportedProtocols = new Set(['http:', 'https:', 'data:', 'blob:'])

export const resolveStoreAssetUrl = (source, apiBaseUrl = API_BASE_URL) => {
  if (typeof source !== 'string' || !source.trim()) return ''

  try {
    const url = new URL(source.trim(), apiBaseUrl ? `${apiBaseUrl}/` : undefined)
    return supportedProtocols.has(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}
