import { storeApiPath } from '../api/store.js'

const MAX_RETRY_DELAY_MS = 30_000
const FATAL_STATUSES = new Set([401, 404])

const wait = (milliseconds, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, milliseconds)
  signal?.addEventListener('abort', () => {
    clearTimeout(timer)
    resolve()
  }, { once: true })
})

const readSse = async (body, onOrderUpdated) => {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) return
      buffer += value
      let match = buffer.match(/\r?\n\r?\n/)
      while (match) {
        const raw = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        const eventType = raw.split(/\r?\n/)
          .find((line) => line.startsWith('event:'))?.slice(6).trim()
        if (eventType === 'ORDER_UPDATED') await onOrderUpdated()
        match = buffer.match(/\r?\n\r?\n/)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// EventSource cannot send X-Order-Tracking-Token, so the stream is read through fetch.
export const subscribeToOrderTrackingEvents = ({
  trackingToken,
  onOrderUpdated,
  onFatalError,
  onConnectionState,
  basePath = storeApiPath,
  fetchImpl = (...args) => fetch(...args)
}) => {
  let stopped = false
  let controller
  let attempt = 0

  const run = async () => {
    while (!stopped) {
      try {
        onConnectionState?.(attempt === 0 ? 'connecting' : 'reconnecting')
        controller = new AbortController()
        const response = await fetchImpl(`${basePath}/orders/current/events`, {
          headers: { Accept: 'text/event-stream', 'X-Order-Tracking-Token': trackingToken },
          signal: controller.signal
        })
        if (FATAL_STATUSES.has(response.status)) {
          onFatalError?.(response.status)
          return
        }
        if (!response.ok || !response.body ||
          !response.headers.get('content-type')?.includes('text/event-stream')) {
          throw new Error('SSE unavailable')
        }
        attempt = 0
        onConnectionState?.('connected')
        await onOrderUpdated() // Covers changes made while the stream was not connected.
        await readSse(response.body, onOrderUpdated)
        if (!stopped) throw new Error('SSE stream closed')
      } catch (error) {
        if (stopped || error?.name === 'AbortError') return
        onConnectionState?.('reconnecting')
        const delay = Math.min(1_000 * 2 ** attempt, MAX_RETRY_DELAY_MS) + Math.floor(Math.random() * 500)
        attempt += 1
        await wait(delay, controller?.signal)
      }
    }
  }

  void run()
  return () => {
    if (stopped) return
    stopped = true
    controller?.abort()
    onConnectionState?.('closed')
  }
}
