import { API_BASE_URL } from '../src/config/store.js'

const allowedMethods = new Set(['GET', 'POST', 'PUT', 'DELETE'])
const forwardedHeaders = ['accept', 'content-type', 'x-cart-token', 'x-order-tracking-token']
const routeParameters = ['storeSlug', 'path']

export const config = { api: { bodyParser: false } }

const readRequestBody = async (request) => {
  if (request.body !== undefined) {
    if (Buffer.isBuffer(request.body) || typeof request.body === 'string') return request.body
    return JSON.stringify(request.body)
  }
  if (typeof request[Symbol.asyncIterator] !== 'function') return undefined

  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks) : undefined
}

// vercel.json rewrites /api/v1/stores/:storeSlug/:path* to this function with both values as query parameters.
const readRoute = (request, requestUrl) => {
  const query = request.query ?? {}
  const queryPath = query.path ?? requestUrl.searchParams.get('path')
  const queryStoreSlug = query.storeSlug ?? requestUrl.searchParams.get('storeSlug')
  if (queryStoreSlug && queryPath) {
    const path = Array.isArray(queryPath) ? queryPath.join('/') : queryPath
    return {
      encodedStoreSlug: encodeURIComponent(Array.isArray(queryStoreSlug) ? queryStoreSlug[0] : queryStoreSlug),
      encodedPathSegments: path.split('/').filter(Boolean).map(encodeURIComponent)
    }
  }

  const routeSegments = requestUrl.pathname.split('/').filter(Boolean)
  const hasStoreApiPrefix = routeSegments[0] === 'api' &&
    routeSegments[1] === 'v1' &&
    routeSegments[2] === 'stores'
  return hasStoreApiPrefix
    ? { encodedStoreSlug: routeSegments[3], encodedPathSegments: routeSegments.slice(4) }
    : { encodedStoreSlug: undefined, encodedPathSegments: [] }
}

export default async function handler(request, response) {
  if (!allowedMethods.has(request.method)) {
    response.setHeader('Allow', [...allowedMethods].join(', '))
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const requestUrl = new URL(request.url, 'http://localhost')
  const { encodedStoreSlug, encodedPathSegments } = readRoute(request, requestUrl)

  if (!encodedStoreSlug || encodedPathSegments.length === 0) {
    return response.status(400).json({ error: 'Invalid store API path' })
  }

  let storeSlug
  let pathSegments
  try {
    storeSlug = decodeURIComponent(encodedStoreSlug)
    pathSegments = encodedPathSegments.map((segment) => decodeURIComponent(segment))
  } catch {
    return response.status(400).json({ error: 'Invalid store API path' })
  }

  const upstreamUrl = new URL(
    `/api/v1/stores/${encodeURIComponent(storeSlug)}/${pathSegments.map(encodeURIComponent).join('/')}`,
    API_BASE_URL
  )
  requestUrl.searchParams.forEach((value, key) => {
    if (!routeParameters.includes(key)) upstreamUrl.searchParams.append(key, value)
  })

  const headers = new Headers()
  for (const name of forwardedHeaders) {
    const value = request.headers[name]
    if (value) headers.set(name, value)
  }

  try {
    const body = ['GET', 'HEAD'].includes(request.method)
      ? undefined
      : await readRequestBody(request)
    const upstreamAbort = new AbortController()
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      signal: upstreamAbort.signal,
      ...(body === undefined ? {} : { body })
    })

    response.status(upstream.status)
    for (const name of ['Content-Type', 'Cache-Control']) {
      const value = upstream.headers.get(name)
      if (value) response.setHeader(name, value)
    }

    if (upstream.status === 204 || upstream.status === 304) return response.end()

    // Order tracking uses Server-Sent Events, which must be forwarded without buffering.
    if (upstream.body && upstream.headers.get('content-type')?.includes('text/event-stream')) {
      const abortUpstream = () => upstreamAbort.abort()
      response.on?.('close', abortUpstream)
      response.setHeader('Cache-Control', 'no-cache, no-transform')
      response.flushHeaders?.()
      try {
        for await (const chunk of upstream.body) {
          response.write(chunk)
          response.flush?.()
        }
      } catch {
        // The client or upstream closed the stream; the browser reconnects on its own.
      }
      return response.end()
    }
    return response.send(await upstream.text())
  } catch {
    return response.status(502).json({ error: 'Could not reach store API' })
  }
}