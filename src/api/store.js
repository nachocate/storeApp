import { STORE_SLUG } from '../config/store.js'
import { requestApi } from './client.js'

export const storeApiPath = `/api/v1/stores/${encodeURIComponent(STORE_SLUG)}`

export const requestStoreApi = async (path, {
  method = 'GET',
  cartToken,
  orderTrackingToken,
  body,
  formData,
  query
} = {}) => {
  const headers = {}
  if (cartToken) headers['X-Cart-Token'] = cartToken
  if (orderTrackingToken) headers['X-Order-Tracking-Token'] = orderTrackingToken

  const queryString = query
    ? new URLSearchParams(Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])).toString()
    : ''
  const querySeparator = path.includes('?') ? '&' : '?'
  const url = `${storeApiPath}${path}${queryString ? `${querySeparator}${queryString}` : ''}`

  return requestApi(url, { method, headers, body, formData })
}