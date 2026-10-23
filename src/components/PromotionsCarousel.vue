<script setup>
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { formatCurrency } from '../utils/formatCurrency.js'

const props = defineProps({
  promotions: { type: Array, required: true },
  busyPromotionId: { type: [String, Number], default: null },
  locked: { type: Boolean, default: false },
  storeClosed: { type: Boolean, default: false }
})

defineEmits(['add-bundle'])

const scroller = ref(null)
const failedImages = ref([])
const scrollState = reactive({ canScrollBack: false, canScrollForward: false })
let resizeObserver = null

const updateScroll = () => {
  const el = scroller.value
  if (!el) return
  scrollState.canScrollBack = el.scrollLeft > 1
  scrollState.canScrollForward = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

const scrollBy = (direction) => {
  const el = scroller.value
  if (!el) return
  el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
}

watch(scroller, (el) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!el) return
  updateScroll()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateScroll)
    resizeObserver.observe(el)
  }
})
watch(() => props.promotions, () => nextTick(updateScroll))
onBeforeUnmount(() => resizeObserver?.disconnect())

const hasDiscount = (promotion) => Number(promotion.discountAmount) > 0
const showImage = (promotion) => promotion.image && !failedImages.value.includes(promotion.id)
</script>

<template>
  <section class="promotions" aria-labelledby="promotions-title">
    <h2 id="promotions-title" class="section-title">Promociones</h2>
    <div class="promotions-carousel">
      <button
        v-if="scrollState.canScrollBack"
        type="button"
        class="promotions-arrow promotions-arrow-back"
        aria-label="Ver promociones anteriores"
        @click="scrollBy(-1)"
      >
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
      </button>
      <ul ref="scroller" class="promotions-track" @scroll.passive="updateScroll">
        <li v-for="promotion in promotions" :key="promotion.id" class="promotion-card">
          <div class="promotion-media">
            <img
              v-if="showImage(promotion)"
              :src="promotion.image"
              :alt="promotion.name"
              loading="lazy"
              @error="failedImages.push(promotion.id)"
            />
            <div v-else class="promotion-media-fallback" role="img" :aria-label="`Imagen de ${promotion.name} no disponible`">
              <i class="pi pi-tag" aria-hidden="true"></i>
            </div>
            <Tag
              v-if="promotion.discountPercent"
              :value="`-${promotion.discountPercent}%`"
              severity="success"
              rounded
              class="promotion-badge"
              :aria-label="`${promotion.discountPercent}% de descuento`"
            />
            <Tag
              v-else-if="hasDiscount(promotion)"
              :value="`-${formatCurrency(promotion.discountAmount, promotion.currency)}`"
              severity="success"
              rounded
              class="promotion-badge"
              :aria-label="`Descuento de ${formatCurrency(promotion.discountAmount, promotion.currency)}`"
            />
          </div>
          <div class="promotion-body">
            <h3>{{ promotion.name }}</h3>
            <p v-if="promotion.description" class="promotion-description">{{ promotion.description }}</p>
            <ul v-if="promotion.products.length" class="promotion-products" aria-label="Productos incluidos">
              <li v-for="(item, index) in promotion.products" :key="`${item.name}-${index}`">
                <span class="promotion-product-quantity">
                  {{ item.quantity }}<template v-if="item.unitSymbol"> {{ item.unitSymbol }}</template>
                </span>
                {{ item.name }}
              </li>
            </ul>
            <p v-if="promotion.totalAmount !== null" class="promotion-prices">
              <s v-if="hasDiscount(promotion) && promotion.originalAmount !== null" class="promotion-original">
                {{ formatCurrency(promotion.originalAmount, promotion.currency) }}
              </s>
              <strong :class="{ 'promotion-total-discounted': hasDiscount(promotion) }">{{ formatCurrency(promotion.totalAmount, promotion.currency) }}</strong>
            </p>
            <Button
              v-if="!storeClosed && promotion.bundleAddable"
              type="button"
              class="promotion-action"
              label="Agregar promoción"
              icon="pi pi-cart-plus"
              :loading="busyPromotionId === promotion.id"
              :disabled="locked"
              :aria-label="`Agregar promoción ${promotion.name}`"
              @click="$emit('add-bundle', promotion)"
            />
            <p v-else-if="!storeClosed" class="promotion-hint">
              Elegí las opciones desde cada producto y la promoción se aplica automáticamente.
            </p>
          </div>
        </li>
      </ul>
      <button
        v-if="scrollState.canScrollForward"
        type="button"
        class="promotions-arrow promotions-arrow-forward"
        aria-label="Ver más promociones"
        @click="scrollBy(1)"
      >
        <i class="pi pi-chevron-right" aria-hidden="true"></i>
      </button>
    </div>
  </section>
</template>

<style scoped>
  .promotions {
    width: 100%;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }

  .section-title {
    margin: 0;
    color: var(--primary-text-color);
    font-size: 1.35rem;
  }

  .promotions-carousel {
    position: relative;
    min-width: 0;
  }

  .promotions-track {
    display: flex;
    gap: 1rem;
    margin: 0;
    padding: 0.25rem 0.1rem 0.75rem;
    overflow-x: auto;
    list-style: none;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
  }

  .promotion-card {
    display: flex;
    flex: 1 0 min(17rem, 78vw);
    flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 16px 32px rgba(17, 24, 39, 0.08), 0 4px 12px rgba(17, 24, 39, 0.04);
    scroll-snap-align: start;
    transition: box-shadow 0.2s ease;
  }

  .promotion-card:hover {
    box-shadow: 0 22px 40px rgba(17, 24, 39, 0.12), 0 8px 16px rgba(17, 24, 39, 0.06);
  }

  .promotion-media {
    position: relative;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    background: #f3f4f6;
  }

  .promotion-media::after {
    position: absolute;
    inset: 66.667% 0 0;
    background: linear-gradient(to bottom, transparent 0%, var(--secondary-color) 100%);
    content: '';
    pointer-events: none;
  }

  .promotion-media img,
  .promotion-media-fallback {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .promotion-media img {
    object-fit: cover;
    object-position: center;
  }

  .promotion-media-fallback {
    display: grid;
    place-items: center;
    color: #6b7280;
    font-size: 2.5rem;
  }

  .promotion-badge {
    position: absolute;
    z-index: 1;
    top: 0.6rem;
    right: 0.6rem;
    background: var(--status-success);
    color: #fff;
    font-size: 0.72rem;
  }

  .promotion-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.9rem;
  }

  .promotion-body h3 {
    margin: 0;
    color: #111827;
    font-size: 1.1rem;
    line-height: 1.3;
  }

  .promotion-description,
  .promotion-hint {
    margin: 0;
    color: #4b5563;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .promotion-products {
    display: grid;
    gap: 0.2rem;
    margin: 0;
    padding: 0;
    color: #374151;
    font-size: 0.9rem;
    list-style: none;
  }

  .promotion-product-quantity {
    font-weight: 700;
  }

  .promotion-prices {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
    color: #111827;
  }

  .promotion-prices strong {
    font-size: 1.15rem;
  }

  .promotion-total-discounted {
    color: var(--status-success);
  }

  .promotion-original {
    color: #6b7280;
    font-size: 0.9rem;
  }

  .promotion-card .promotion-action.p-button {
    width: 100%;
    min-height: 2.75rem;
    margin-top: auto;
    border-radius: 12px;
    font-weight: 700;
  }

  .promotion-hint {
    margin-top: auto;
    font-style: italic;
  }

  .promotions-arrow {
    position: absolute;
    top: 40%;
    z-index: 1;
    display: none;
    width: 2.5rem;
    height: 2.5rem;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--primary-color) 48%, #fff);
    border-radius: 999px;
    background: #fff;
    color: var(--primary-text-color);
    box-shadow: 0 4px 12px rgba(17, 24, 39, 0.15);
    cursor: pointer;
  }

  .promotions-arrow:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--primary-color) 45%, transparent);
    outline-offset: 2px;
  }

  .promotions-arrow-back {
    left: -0.5rem;
  }

  .promotions-arrow-forward {
    right: -0.5rem;
  }

  /* Touch devices scroll with the finger; arrows are only for mouse users. */
  @media (hover: hover) and (pointer: fine) {
    .promotions-arrow {
      display: grid;
    }
  }
</style>
