import { describe, expect, it, vi } from 'vitest'
import { subscribeToOrderTrackingEvents } from './orderTrackingSse.js'

const streamResponse = (chunks, status = 200) => new Response(
  new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)))
      controller.close()
    }
  }),
  { status, headers: { 'Content-Type': 'text/event-stream' } }
)

describe('subscribeToOrderTrackingEvents', () => {
  it('sends the tracking token as a header and refreshes on connect and ORDER_UPDATED', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(streamResponse([
      ': heartbeat\n\n',
      'id: 9\nevent: ORDER_UPDATED\ndata: {"id":"9"}\n\n'
    ]))
    const onOrderUpdated = vi.fn()
    const states = []
    const unsubscribe = subscribeToOrderTrackingEvents({
      trackingToken: 'secret',
      basePath: '/api/v1/stores/demo',
      fetchImpl,
      onOrderUpdated,
      onConnectionState: (state) => states.push(state)
    })

    await vi.waitFor(() => expect(onOrderUpdated).toHaveBeenCalledTimes(2))
    unsubscribe()

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/v1/stores/demo/orders/current/events')
    expect(options.headers['X-Order-Tracking-Token']).toBe('secret')
    expect(states).toContain('connected')
  })

  it('does not retry after 401 or 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    const onFatalError = vi.fn()
    subscribeToOrderTrackingEvents({
      trackingToken: 'secret',
      fetchImpl,
      onOrderUpdated: vi.fn(),
      onFatalError
    })

    await vi.waitFor(() => expect(onFatalError).toHaveBeenCalledWith(404))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
