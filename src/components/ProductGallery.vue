<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  images: { type: Array, default: () => [] },
  alt: { type: String, required: true },
  fallbackIcon: { type: String, default: 'pi pi-shopping-bag' }
})

const failedImages = ref(new Set())
const activeIndex = ref(0)
const trackEl = ref(null)

const visibleImages = computed(() => props.images.filter((image) => !failedImages.value.has(image)))
const hasMultipleImages = computed(() => visibleImages.value.length > 1)

watch(() => props.images, () => {
  failedImages.value = new Set()
  activeIndex.value = 0
})

const markFailed = (image) => {
  failedImages.value = new Set([...failedImages.value, image])
  activeIndex.value = Math.min(activeIndex.value, Math.max(visibleImages.value.length - 1, 0))
}

const goTo = (index) => {
  const track = trackEl.value
  if (!track) return
  const count = visibleImages.value.length
  const target = (index + count) % count
  activeIndex.value = target
  track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' })
}

const syncActiveIndex = () => {
  const track = trackEl.value
  if (!track || !track.clientWidth) return
  activeIndex.value = Math.round(track.scrollLeft / track.clientWidth)
}

const onKeydown = (event) => {
  if (!hasMultipleImages.value) return
  if (event.key === 'ArrowLeft') goTo(activeIndex.value - 1)
  else if (event.key === 'ArrowRight') goTo(activeIndex.value + 1)
  else return
  event.preventDefault()
}
</script>

<template>
  <div v-if="!visibleImages.length" class="gallery gallery-fallback" role="img" :aria-label="`Imagen de ${alt} no disponible`">
    <i :class="fallbackIcon" aria-hidden="true"></i>
  </div>
  <div v-else-if="!hasMultipleImages" class="gallery">
    <img class="gallery-image" :src="visibleImages[0]" :alt="alt" @error="markFailed(visibleImages[0])" />
  </div>
  <div
    v-else
    class="gallery"
    role="group"
    aria-roledescription="carrusel"
    :aria-label="`Imágenes de ${alt}`"
    tabindex="0"
    @keydown="onKeydown"
  >
    <div ref="trackEl" class="gallery-track" @scroll.passive="syncActiveIndex">
      <img
        v-for="(image, index) in visibleImages"
        :key="image"
        class="gallery-image gallery-slide"
        :src="image"
        :alt="`${alt} (${index + 1} de ${visibleImages.length})`"
        @error="markFailed(image)"
      />
    </div>
    <button type="button" class="gallery-arrow gallery-arrow-prev" aria-label="Imagen anterior" @click="goTo(activeIndex - 1)">
      <i class="pi pi-chevron-left" aria-hidden="true"></i>
    </button>
    <button type="button" class="gallery-arrow gallery-arrow-next" aria-label="Imagen siguiente" @click="goTo(activeIndex + 1)">
      <i class="pi pi-chevron-right" aria-hidden="true"></i>
    </button>
    <div class="gallery-dots">
      <button
        v-for="(image, index) in visibleImages"
        :key="image"
        type="button"
        class="gallery-dot"
        :class="{ active: index === activeIndex }"
        :aria-label="`Ver imagen ${index + 1} de ${visibleImages.length}`"
        :aria-current="index === activeIndex"
        @click="goTo(index)"
      ></button>
    </div>
  </div>
</template>

<style scoped>
  .gallery {
    position: relative;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border-radius: 20px;
    background: #f3f4f6;
  }

  .gallery:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .gallery-image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gallery-track {
    display: flex;
    height: 100%;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .gallery-track::-webkit-scrollbar {
    display: none;
  }

  .gallery-slide {
    flex: 0 0 100%;
    scroll-snap-align: center;
  }

  .gallery-fallback {
    display: grid;
    place-items: center;
    color: #6b7280;
  }

  .gallery-fallback i {
    font-size: 4rem;
  }

  .gallery-arrow {
    position: absolute;
    top: 50%;
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    transform: translateY(-50%);
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 12px rgba(17, 24, 39, 0.2);
    color: #111827;
    cursor: pointer;
  }

  .gallery-arrow:focus-visible,
  .gallery-dot:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .gallery-arrow-prev {
    left: 0.6rem;
  }

  .gallery-arrow-next {
    right: 0.6rem;
  }

  .gallery-dots {
    position: absolute;
    right: 0;
    bottom: 0.8rem;
    left: 0;
    display: flex;
    justify-content: center;
    gap: 0.2rem;
  }

  .gallery-dot {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .gallery-dot::before {
    display: block;
    width: 0.6rem;
    height: 0.6rem;
    margin: auto;
    border: 2px solid #fff;
    border-radius: 50%;
    background: rgba(17, 24, 39, 0.35);
    content: '';
  }

  .gallery-dot.active::before {
    background: var(--primary-color);
  }
</style>
