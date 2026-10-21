import { onScopeDispose, ref, watch } from 'vue'
import { subscribeToOrderTrackingEvents } from '../services/orderTrackingSse.js'

export const useOrderTracking = ({
  orderId,
  orders,
  syncOrder,
  subscribe = subscribeToOrderTrackingEvents,
  pollIntervalMs = 25_000
}) => {
  const connection = ref('closed')
  const unavailable = ref(false)
  const finished = ref(false)
  const loading = ref(false)
  let unsubscribe = null
  let pollTimer = null
  let refreshing = null
  let generation = 0

  const refresh = () => {
    if (refreshing) return refreshing
    const requestedId = orderId()
    const requestedGeneration = generation
    const current = (async () => {
      const result = await syncOrder(requestedId)
      if (requestedGeneration !== generation) return
      if (result === 'completed') {
        finished.value = true
        stop()
      } else if (result === 'unavailable') {
        unavailable.value = true
        stop()
      }
    })().finally(() => { if (refreshing === current) refreshing = null })
    refreshing = current
    return current
  }

  const refreshWhenVisible = () => {
    if (document.visibilityState === 'visible') void refresh()
  }

  function stop() {
    generation += 1
    refreshing = null
    unsubscribe?.()
    unsubscribe = null
    if (pollTimer) window.clearInterval(pollTimer)
    pollTimer = null
    document.removeEventListener('visibilitychange', refreshWhenVisible)
    connection.value = 'closed'
  }

  const start = async (id) => {
    stop()
    unavailable.value = false
    finished.value = false
    if (id === undefined || id === null || id === '') return
    const record = orders.value.find((order) => order.orderId === id)
    if (!record) {
      unavailable.value = true
      return
    }

    const currentGeneration = generation
    loading.value = true
    await refresh()
    loading.value = false
    if (currentGeneration !== generation || unavailable.value) return

    const trackingToken = record.orderTrackingToken
    unsubscribe = subscribe({
      trackingToken,
      onOrderUpdated: refresh,
      onFatalError: () => {
        unavailable.value = true
        stop()
      },
      onConnectionState: (state) => {
        if (currentGeneration === generation) connection.value = state
      }
    })
    // Moderate polling is only a fallback for networks that block the stream.
    pollTimer = window.setInterval(() => {
      if (connection.value !== 'connected') void refresh()
    }, pollIntervalMs)
    document.addEventListener('visibilitychange', refreshWhenVisible)
  }

  watch(orderId, (id) => { void start(id) }, { immediate: true })
  onScopeDispose(stop)

  return { connection, finished, loading, unavailable, refresh }
}
