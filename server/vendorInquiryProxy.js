import { API_BASE_URL } from '../src/config/store.js'
import { readRequestBody } from './storeProxy.js'

export const config = { api: { bodyParser: false } }

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const upstream = await fetch(new URL('/api/v1/vendor-inquiries', API_BASE_URL), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': request.headers['content-type'] ?? 'application/json'
      },
      body: await readRequestBody(request)
    })

    response.status(upstream.status)
    const contentType = upstream.headers.get('Content-Type')
    if (contentType) response.setHeader('Content-Type', contentType)
    if (upstream.status === 204) return response.end()
    return response.send(await upstream.text())
  } catch {
    return response.status(502).json({ error: 'Could not reach vendor inquiries API' })
  }
}
