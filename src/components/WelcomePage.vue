<script setup>
import { ref } from 'vue'
import logoUrl from '../assets/logo.svg'
import { CONTACT_PATH } from '../config/store.js'
import TiendarioHeader from './TiendarioHeader.vue'

const REPEL_RADIUS = 260
const MAX_REPEL_DISTANCE = 48
// [left %, top %, size rem, rotation deg]
const STORE_MARK_LAYOUT = [
  [3, 4, 3.5, -10], [16, 8, 4.5, 12], [30, 2, 3, -6], [44, 7, 4, 9],
  [57, 3, 5, -12], [71, 9, 3.5, 15], [84, 2, 4.5, -5], [95, 10, 3, 10],
  [8, 24, 4, 7], [22, 28, 3, -14], [36, 22, 5, -4], [50, 27, 3.5, 13],
  [64, 21, 4, -9], [77, 27, 6, 9], [91, 23, 3.5, -16],
  [2, 44, 5, -8], [15, 48, 3.5, 16], [29, 42, 4, 6], [43, 47, 3, -11],
  [56, 41, 4.5, 14], [70, 46, 3.5, -17], [85, 43, 5.5, -10],
  [9, 64, 3.5, 11], [23, 68, 4.5, -7], [37, 62, 3, 18], [51, 67, 4, -13],
  [63, 63, 3.5, 8], [76, 69, 4.5, 12], [92, 62, 3.5, -6],
  [3, 84, 4, -12], [17, 88, 3, 9], [31, 82, 4.5, -5], [45, 87, 3.5, 15],
  [59, 83, 4, -9], [72, 88, 3, 6], [86, 82, 4.5, 15], [97, 86, 3.5, -8]
]

const storeMarks = STORE_MARK_LAYOUT.map(([left, top, size, rotation], index) => ({
  id: index + 1,
  left,
  top,
  size,
  rotation,
  delay: -((index * 0.7) % 6),
  compact: index % 2 === 0
}))
const markElements = []
const markOffsets = ref(storeMarks.map(() => ({ x: 0, y: 0 })))

const getRepelOffset = (element, pointerX, pointerY) => {
  if (!element || element.offsetParent === null) return { x: 0, y: 0 }

  // offset* ignores transforms, so the distance uses each logo's resting position.
  const deltaX = element.offsetLeft + element.offsetWidth / 2 - pointerX
  const deltaY = element.offsetTop + element.offsetHeight / 2 - pointerY
  const distance = Math.hypot(deltaX, deltaY)
  if (distance >= REPEL_RADIUS || distance === 0) return { x: 0, y: 0 }

  const strength = (1 - distance / REPEL_RADIUS) ** 2 * MAX_REPEL_DISTANCE
  return { x: (deltaX / distance) * strength, y: (deltaY / distance) * strength }
}

const updateStoreMarks = (event) => {
  if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const bounds = event.currentTarget.getBoundingClientRect()
  const pointerX = event.clientX - bounds.left
  const pointerY = event.clientY - bounds.top
  markOffsets.value = markElements.map((element) => getRepelOffset(element, pointerX, pointerY))
}

const resetStoreMarks = () => {
  markOffsets.value = storeMarks.map(() => ({ x: 0, y: 0 }))
}

const getStoreMarkStyle = (mark, index) => {
  const offset = markOffsets.value[index] ?? { x: 0, y: 0 }
  return {
    left: `${mark.left}%`,
    top: `${mark.top}%`,
    '--mark-size': `${mark.size}rem`,
    rotate: `${mark.rotation}deg`,
    animationDelay: `${mark.delay}s`,
    transform: `translate(${offset.x}px, ${offset.y}px)`
  }
}
</script>

<template>
  <main class="tiendario-site welcome-page">
    <TiendarioHeader />

    <section
      class="welcome-hero"
      aria-labelledby="welcome-title"
      @pointermove="updateStoreMarks"
      @pointerleave="resetStoreMarks"
    >
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="hero-store-marks" aria-hidden="true">
        <img
          v-for="(mark, index) in storeMarks"
          :key="mark.id"
          :ref="(element) => { markElements[index] = element }"
          :src="logoUrl"
          :class="['hero-store-mark', { 'hero-store-mark--wide-only': !mark.compact }]"
          :style="getStoreMarkStyle(mark, index)"
          alt=""
        />
      </div>
      <div class="hero-content">
        <h1 id="welcome-title">Un lugar para el comercio independiente</h1>
        <p>Modernizamos tu tienda online. Diseños rápidos e intuitivos enfocados en potenciar tus ventas y brindar una experiencia de compra impecable.</p>
        <div class="hero-actions">
          <Button
            as="a"
            :href="CONTACT_PATH"
            label="Quiero ser parte"
            class="tiendario-button tiendario-button--outline"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.welcome-hero {
  position: relative;
  display: flex;
  flex: 1 0 auto;
  min-height: min(70vh, 680px);
  align-items: center;
  isolation: isolate;
  overflow: hidden;
  background: var(--tiendario-secondary);
  color: var(--paper);
  border-radius: 20px;
}

.hero-store-marks {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.hero-store-mark {
  position: absolute;
  display: block;
  width: calc(var(--mark-size) * var(--mark-scale, 1));
  height: auto;
  margin: calc(var(--mark-size) * var(--mark-scale, 1) / -2) 0 0 calc(var(--mark-size) * var(--mark-scale, 1) / -2);
  padding: 0.45rem;
  border: 1px solid rgb(250 250 250 / 30%);
  border-radius: 0.8rem;
  background: rgb(250 250 250 / 20%);
  box-shadow: 0 12px 24px rgb(0 0 0 / 16%);
  opacity: 0.6;
  transition: transform 450ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: store-mark-float 6s ease-in-out infinite alternate;
}













.hero-content {
  position: relative;
  z-index: 2;
  width: min(760px, 78%);
  padding: clamp(3rem, 8vw, 7rem);
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 24px;
  background: rgb(255 255 255 / 9%);
  box-shadow: 0 24px 70px rgb(0 0 0 / 12%), inset 0 1px 0 rgb(255 255 255 / 24%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: arrive 650ms ease-out both;
  container-type: inline-size;
}

.hero-content h1 {
  max-width: 15ch;
  margin: 0;
  /* "independiente" is ~7.7em wide, so the size follows the panel's inner width to avoid overflow. */
  font-size: clamp(1.75rem, 12cqi, 4rem);
  font-weight: 700;
  line-height: 0.99;
  overflow-wrap: break-word;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 2rem;
}

.hero-shade {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 82% 18%, rgb(255 255 255 / 28%), transparent 34%),
    radial-gradient(ellipse at 12% 100%, rgb(0 0 0 / 14%), transparent 42%),
    linear-gradient(125deg, rgb(255 255 255 / 8%), transparent 54%);
  pointer-events: none;
}

.hero-shade::before {
  position: absolute;
  content: '';
  inset: 0;
  background: linear-gradient(112deg, transparent 34%, rgb(255 255 255 / 10%) 49%, transparent 64%);
  transform: translateX(-100%);
  animation: hero-glint 8s ease-in-out infinite;
}

@keyframes arrive {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes store-mark-float {
  from { translate: 0 10px; }
  to { translate: 0 -10px; }
}

@keyframes hero-glint {
  0%, 30% { transform: translateX(-100%); }
  75%, 100% { transform: translateX(100%); }
}

@media (max-width: 1024px) {
  .hero-store-mark {
    --mark-scale: 0.8;
  }
}

@media (max-width: 640px) {
  .welcome-hero {
    min-height: 65vh;
  }

  .hero-store-mark {
    --mark-scale: 0.62;
    opacity: 0.42;
  }

  .hero-store-mark--wide-only {
    display: none;
  }

  .hero-content {
    width: 100%;
    padding: 2rem 1.25rem 4rem;
  }

  .hero-actions {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-content,
  .hero-store-mark,
  .hero-shade::before {
    animation: none;
  }

  .hero-store-mark {
    transition: none;
  }
}
</style>