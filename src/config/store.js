export const resolveApiBaseUrl = (environment = {}) => {
  const configuredUrl = environment.API_BASE_URL

  if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) {
    return ''
  }

  try {
    const url = new URL(configuredUrl.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.href.replace(/\/$/, '')
  } catch {
    return ''
  }
}

const runtimeEnvironment = {
  API_BASE_URL: import.meta.env?.API_BASE_URL ?? globalThis.process?.env?.API_BASE_URL
}

export const API_BASE_URL = resolveApiBaseUrl(runtimeEnvironment)

export const DEFAULT_BASE_DOMAIN = 'tiendario.cloud'
// "dev" is the app's own host (dev.tiendario.cloud), not a store.
const RESERVED_SUBDOMAINS = ['www', 'dev']

export const resolveBaseDomain = (environment = {}) => {
  const configured = environment.VITE_BASE_DOMAIN
  const value = typeof configured === 'string' ? configured.trim().toLowerCase() : ''
  return value || DEFAULT_BASE_DOMAIN
}

export const BASE_DOMAIN = resolveBaseDomain({
  VITE_BASE_DOMAIN: import.meta.env?.VITE_BASE_DOMAIN
})

// Returns the store slug from "slug.<baseDomain>", or '' when the host is not a store subdomain.
export const resolveSubdomainSlug = (hostname = '', baseDomain = BASE_DOMAIN) => {
  const host = hostname.toLowerCase()
  const suffix = `.${baseDomain}`
  if (!host.endsWith(suffix)) return ''

  const label = host.slice(0, -suffix.length)
  if (!label || label.includes('.') || RESERVED_SUBDOMAINS.includes(label)) return ''
  return label
}

const isBaseDomainHost = (hostname = '', baseDomain = BASE_DOMAIN) => {
  const host = hostname.toLowerCase()
  return host === baseDomain || host.endsWith(`.${baseDomain}`)
}

const currentHostname = globalThis.window?.location.hostname ?? ''
const subdomainSlug = resolveSubdomainSlug(currentHostname)
// Path-based slugs remain only for hosts outside the base domain (local development).
const usesPathSlug = !isBaseDomainHost(currentHostname)
const pathnameSegments = globalThis.window?.location.pathname.split('/').filter(Boolean) ?? []
const requestedSlug = subdomainSlug || (usesPathSlug ? pathnameSegments[0] : '')
let storeSlug = 'almacen-demo'

export const IS_HOME = !requestedSlug

export const buildStorePath = (slug, pathBased = usesPathSlug) =>
  pathBased ? `/${encodeURIComponent(slug)}` : '/'

export const resolveRequestedOrderId = (pathname = '', search = '', pathBased = true) => {
  const segments = pathname.split('/').filter(Boolean)
  const ordersIndex = pathBased ? 1 : 0
  const pathOrderId = segments[ordersIndex] === 'orders' ? segments[ordersIndex + 1] : ''
  const queryOrderId = new URLSearchParams(search).get('orderId')
  if (queryOrderId) return queryOrderId.trim()
  if (!pathOrderId) return ''

  try {
    return decodeURIComponent(pathOrderId).trim()
  } catch {
    return pathOrderId.trim()
  }
}

export const REQUESTED_ORDER_ID = resolveRequestedOrderId(
  globalThis.window?.location.pathname ?? '',
  globalThis.window?.location.search ?? '',
  usesPathSlug
)

if (requestedSlug) {
	try {
		storeSlug = decodeURIComponent(requestedSlug)
	} catch {
		storeSlug = requestedSlug
	}
}

export const STORE_SLUG = storeSlug
