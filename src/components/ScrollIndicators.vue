<script setup>
import { markRaw, onBeforeUnmount, onMounted, reactive } from 'vue'

const indicators = reactive([])
const entriesByElement = new Map()
const observedResizeTargets = new Set()
let resizeObserver = null
let mutationObserver = null
let scanFrame = 0
let nextIndicatorId = 0

const isScrollableOverflow = (value) => ['auto', 'scroll', 'overlay'].includes(value)

const readMetrics = (element, axis) => {
  const isDocument = element === document.scrollingElement
  const isHorizontal = axis === 'horizontal'
  if (isDocument) {
    if (document.body.classList.contains('p-overflow-hidden') ||
      document.documentElement.classList.contains('product-page-open')) return null

    const viewportSize = isHorizontal ? window.innerWidth : window.innerHeight
    const scrollSize = isHorizontal
      ? document.documentElement.scrollWidth
      : document.documentElement.scrollHeight
    if (scrollSize <= viewportSize + 1) return null

    return {
      isDocument: true,
      viewportSize,
      scrollSize,
      offset: isHorizontal ? window.scrollX : window.scrollY,
      rect: isHorizontal
        ? { left: 0, right: window.innerWidth, top: window.innerHeight - 3, bottom: window.innerHeight }
        : { left: window.innerWidth - 3, right: window.innerWidth, top: 0, bottom: window.innerHeight }
    }
  }

  const style = getComputedStyle(element)
  const overflow = isHorizontal ? style.overflowX : style.overflowY
  if (!isScrollableOverflow(overflow)) return null

  const viewportSize = isHorizontal ? element.clientWidth : element.clientHeight
  const scrollSize = isHorizontal ? element.scrollWidth : element.scrollHeight
  if (viewportSize <= 0 || scrollSize <= viewportSize + 1) return null

  const rect = element.getBoundingClientRect()
  return {
    isDocument: false,
    viewportSize,
    scrollSize,
    offset: isHorizontal ? element.scrollLeft : element.scrollTop,
    rect
  }
}

const updateIndicator = (indicator) => {
  const { element, axis } = indicator
  if (!element.isConnected) {
    indicator.visible = false
    return false
  }

  const metrics = readMetrics(element, axis)
  if (!metrics) {
    indicator.visible = false
    return false
  }

  const isHorizontal = axis === 'horizontal'
  const maxScroll = metrics.scrollSize - metrics.viewportSize
  const trackStart = isHorizontal ? metrics.rect.left : metrics.rect.top
  const trackEnd = isHorizontal ? metrics.rect.right : metrics.rect.bottom
  const trackSize = trackEnd - trackStart
  if (trackSize <= 0) {
    indicator.visible = false
    return false
  }

  const thumbSize = Math.min(
    metrics.viewportSize,
    Math.max(24, (metrics.viewportSize * metrics.viewportSize) / metrics.scrollSize)
  )
  const thumbOffset = Math.min(
    trackSize - thumbSize,
    Math.max(0, (metrics.offset / maxScroll) * (trackSize - thumbSize))
  )
  const visibleTrackStart = Math.max(0, trackStart)
  const visibleTrackEnd = Math.min(isHorizontal ? window.innerWidth : window.innerHeight, trackEnd)
  const colorSource = metrics.isDocument ? document.querySelector('#app') ?? element : element
  const color = getComputedStyle(colorSource).getPropertyValue('--primary-color').trim() || '#64748b'

  indicator.visible = visibleTrackEnd > visibleTrackStart
  indicator.trackStyle = isHorizontal
    ? {
        left: `${visibleTrackStart}px`,
        top: `${metrics.isDocument ? metrics.rect.top : metrics.rect.bottom - 3}px`,
        width: `${visibleTrackEnd - visibleTrackStart}px`,
        height: '3px'
      }
    : {
        left: `${metrics.isDocument ? metrics.rect.left : metrics.rect.right - 3}px`,
        top: `${visibleTrackStart}px`,
        width: '3px',
        height: `${visibleTrackEnd - visibleTrackStart}px`
      }
  indicator.thumbStyle = isHorizontal
    ? {
        width: `${thumbSize}px`,
        transform: `translateX(${thumbOffset}px)`,
        backgroundColor: color
      }
    : {
        height: `${thumbSize}px`,
        transform: `translateY(${thumbOffset}px)`,
        backgroundColor: color
      }
  return true
}

const updateIndicators = () => {
  for (const indicator of indicators) updateIndicator(indicator)
}

const addIndicator = (element, axis, found) => {
  let elementEntries = entriesByElement.get(element)
  if (!elementEntries) {
    elementEntries = new Map()
    entriesByElement.set(element, elementEntries)
  }

  let indicator = elementEntries.get(axis)
  if (!indicator) {
    indicator = reactive({
      id: nextIndicatorId++,
      element: markRaw(element),
      axis,
      visible: false,
      trackStyle: {},
      thumbStyle: {}
    })
    elementEntries.set(axis, indicator)
    indicators.push(indicator)
  }

  if (updateIndicator(indicator)) found.add(indicator)
}

const scanScrollableElements = () => {
  const found = new Set()
  const scrollingElement = document.scrollingElement
  const candidates = [scrollingElement, ...document.querySelectorAll('*')]

  for (const element of candidates) {
    if (!element || element.closest?.('.scroll-indicators-layer')) continue
    if (element.hasAttribute?.('data-hide-scroll-indicator')) continue
    if (element !== scrollingElement) {
      const style = getComputedStyle(element)
      const axes = [
        ['horizontal', style.overflowX],
        ['vertical', style.overflowY]
      ]
      for (const [axis, overflow] of axes) {
        if (isScrollableOverflow(overflow)) addIndicator(element, axis, found)
      }
    } else {
      addIndicator(element, 'vertical', found)
      addIndicator(element, 'horizontal', found)
    }
  }

  for (const indicator of [...indicators]) {
    if (found.has(indicator)) continue
    indicators.splice(indicators.indexOf(indicator), 1)
    const elementEntries = entriesByElement.get(indicator.element)
    elementEntries?.delete(indicator.axis)
    if (elementEntries?.size === 0) entriesByElement.delete(indicator.element)
  }

  if (resizeObserver) {
    observeResizeTarget(document.documentElement)
    observeResizeTarget(document.body)
    for (const indicator of found) {
      observeResizeTarget(indicator.element)
      for (const child of indicator.element.children) observeResizeTarget(child)
    }
    for (const element of observedResizeTargets) {
      if (element.isConnected || element === document.documentElement || element === document.body) continue
      resizeObserver.unobserve(element)
      observedResizeTargets.delete(element)
    }
  }
}

const scheduleScan = () => {
  if (scanFrame) return
  scanFrame = window.requestAnimationFrame(() => {
    scanFrame = 0
    scanScrollableElements()
  })
}

const observeResizeTarget = (element) => {
  if (!resizeObserver || observedResizeTargets.has(element)) return
  observedResizeTargets.add(element)
  resizeObserver.observe(element)
}

const handleMutations = (records) => {
  if (records.some((record) => !record.target.closest?.('.scroll-indicators-layer'))) scheduleScan()
}

onMounted(() => {
  document.addEventListener('scroll', updateIndicators, { capture: true, passive: true })
  window.addEventListener('resize', scheduleScan)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleScan)
  }
  mutationObserver = new MutationObserver(handleMutations)
  mutationObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden'],
    characterData: true,
    childList: true,
    subtree: true
  })
  scanScrollableElements()
})

onBeforeUnmount(() => {
  document.removeEventListener('scroll', updateIndicators, true)
  window.removeEventListener('resize', scheduleScan)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  if (scanFrame) window.cancelAnimationFrame(scanFrame)
})
</script>

<template>
  <Teleport to="body">
    <div class="scroll-indicators-layer" aria-hidden="true">
      <div
        v-for="indicator in indicators"
        v-show="indicator.visible"
        :key="indicator.id"
        class="scroll-indicator-track"
        :class="`scroll-indicator-${indicator.axis}`"
        :style="indicator.trackStyle"
      >
        <span class="scroll-indicator-thumb" :style="indicator.thumbStyle"></span>
      </div>
    </div>
  </Teleport>
</template>

<style>
.scroll-indicators-layer {
  position: fixed;
  z-index: 1100;
  inset: 0;
  pointer-events: none;
}

.scroll-indicator-track {
  position: absolute;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
}

.scroll-indicator-vertical {
  width: 3px;
}

.scroll-indicator-horizontal {
  height: 3px;
}

.scroll-indicator-thumb {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: inherit;
  opacity: 0.7;
}

.scroll-indicator-vertical .scroll-indicator-thumb {
  width: 100%;
}

.scroll-indicator-horizontal .scroll-indicator-thumb {
  height: 100%;
}
</style>
