<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  product: { type: Object, required: true },
  quantityLabel: { type: String, required: true },
  storeClosed: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  inCart: { type: Boolean, default: false },
  decreaseRemovesItem: { type: Boolean, default: false },
  unavailable: { type: Boolean, default: false },
  decreaseDisabled: { type: Boolean, default: false },
  increaseDisabled: { type: Boolean, default: false }
})

defineEmits(['change-quantity', 'add-to-cart', 'remove-from-cart'])

const displayInCart = ref(props.inCart)
const imageFailed = ref(false)
const hoveredQuantityControl = ref('')

watch(() => [props.inCart, props.busy], ([inCart, busy]) => {
  if (!busy) displayInCart.value = inCart
}, { immediate: true })
watch(() => props.product.image, () => {
  imageFailed.value = false
})

const unitPriceLabel = computed(() =>
  `$${props.product.pricePerType.toFixed(2)} / ${props.product.unitSymbol ?? 'u'}`)

const addAriaLabel = computed(() => props.busy
  ? 'Procesando producto'
  : props.inCart
    ? `Añadido ${props.product.name}`
    : props.product.isSoldOut
      ? `Agotado ${props.product.name}`
      : `Añadir ${props.product.name}`)
</script>

<template>
  <Card class="product-card">
    <template #header>
      <img
        v-if="product.image && !imageFailed"
        class="product-image"
        :src="product.image"
        :alt="product.name"
        loading="lazy"
        @error="imageFailed = true"
      />
      <div v-else class="product-image product-image-fallback" role="img" :aria-label="`Imagen de ${product.name} no disponible`">
        <i :class="product.imageFallback === 'pastry' ? 'pi pi-sparkles' : product.imageFallback === 'accessory' ? 'pi pi-gift' : 'pi pi-shopping-bag'" aria-hidden="true"></i>
      </div>
      <Tag :value="product.category" severity="primary" rounded class="category-badge" />
      <small class="product-price-base image-price">{{ unitPriceLabel }}</small>
    </template>

    <template #content>
      <div class="product-body">
      <h3>{{ product.name }}</h3>
      <p class="product-description">{{ product.description }}</p>

      <p v-if="!storeClosed && unavailable" class="product-unavailable" role="status">No disponible</p>
      <Button
        v-else-if="!storeClosed && !displayInCart"
        class="add-to-cart"
        type="button"
        label="Agregar al carrito"
        icon="pi pi-cart-plus"
        :disabled="busy || locked || product.isSoldOut"
        :loading="busy"
        loading-icon="pi pi-spin pi-spinner"
        :aria-label="addAriaLabel"
        @click="$emit('add-to-cart')"
      />
      <div v-else-if="!storeClosed" class="product-quantity" aria-label="Seleccionar cantidad">
        <Button
          type="button"
          :disabled="busy || locked || (unavailable && !decreaseRemovesItem) || decreaseDisabled"
          :aria-label="decreaseRemovesItem ? `Eliminar ${product.name} del carrito` : `Reducir cantidad de ${product.name}`"
          :icon="decreaseRemovesItem ? 'pi pi-trash' : 'pi pi-minus'"
          severity="secondary"
          :text="hoveredQuantityControl !== 'decrease'"
          rounded
          @mouseenter="hoveredQuantityControl = 'decrease'"
          @mouseleave="hoveredQuantityControl = ''"
          @click="decreaseRemovesItem ? $emit('remove-from-cart') : $emit('change-quantity', -product.step)"
        />
        <span>{{ quantityLabel }}</span>
        <Button
          type="button"
          :disabled="busy || locked || unavailable || increaseDisabled"
          :aria-label="`Aumentar cantidad de ${product.name}`"
          icon="pi pi-plus"
          severity="secondary"
          :text="hoveredQuantityControl !== 'increase'"
          rounded
          @mouseenter="hoveredQuantityControl = 'increase'"
          @mouseleave="hoveredQuantityControl = ''"
          @click="$emit('change-quantity', product.step)"
        />
      </div>

      </div>
    </template>
  </Card>
</template>

<style scoped>
  .product-card {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 16px 32px rgba(17, 24, 39, 0.08), 0 4px 12px rgba(17, 24, 39, 0.04);
    transition: box-shadow 0.2s ease;
  }

  .product-card :deep(.p-card-body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 0;
  }

  .product-card :deep(.p-card-header),
  .product-card :deep(.p-card-content) {
    padding: 0;
  }

  .product-card :deep(.p-card-content) {
    display: flex;
    flex: 1;
  }

  .product-card:hover {
    box-shadow: 0 22px 40px rgba(17, 24, 39, 0.12), 0 8px 16px rgba(17, 24, 39, 0.06);
  }

  .product-card {
    width: 100%;
    max-width: 350px;
    justify-self: center;
  }

  .product-image {
    width: 100%;
    height: 220px;
    object-fit: cover;
    background: #f4f4f4;
  }

  .product-card :deep(.p-card-header) {
    position: relative;
    aspect-ratio: 1 / 1;
    overflow: hidden;
  }

  .product-card :deep(.p-card-header)::after {
    position: absolute;
    inset: 66.667% 0 0;
    background: linear-gradient(to bottom, transparent 0%, var(--secondary-color) 100%);
    content: '';
    pointer-events: none;
  }

  .product-card .product-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .product-image-fallback {
    display: grid;
    place-items: center;
    background: #f3f4f6;
    color: #6b7280;
  }

  .product-image-fallback svg {
    width: 4rem;
    height: 4rem;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  .product-image-fallback i {
    color: currentColor;
    font-size: 3.5rem;
  }

  .product-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1rem;
  }

  .product-price-base {
    color: #4b5563;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .image-price {
    position: absolute;
    left: 0.6rem;
    bottom: 0.6rem;
    z-index: 1;
    padding: 0;
    color: var(--secondary-contrast-color);
    font-size: 1rem;
    font-weight: 800;
  }

  .product-card h3 {
    margin: 0;
    font-size: 1.2rem;
    line-height: 1.3;
    color: #111827;
  }

  .product-description {
    margin: 0;
    max-height: 4.5em;
    overflow-y: auto;
    overscroll-behavior: contain;
    color: #4b5563;
    line-height: 1.5;
    scrollbar-color: #9ca3af transparent;
    scrollbar-width: thin;
  }

  .product-card .add-to-cart.p-button {
    width: 100%;
    min-height: 3rem;
    margin-top: auto;
    border-radius: 12px;
    font-weight: 700;
  }

  .product-quantity {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    margin-top: auto;
    padding: 0.5rem 0.7rem;
    border-radius: 12px;
    background: color-mix(in srgb, var(--secondary-color) 20%, #fff);
    border: 1px solid color-mix(in srgb, var(--secondary-color) 52%, #fff);
    font-weight: 700;
  }

  .product-unavailable {
    margin: auto 0 0;
    padding: 0.75rem 0.7rem;
    border: 1px solid color-mix(in srgb, var(--primary-on-background-color, #18251c) 25%, #fff);
    border-radius: 12px;
    background: color-mix(in srgb, var(--primary-on-background-color, #18251c) 8%, #fff);
    color: var(--primary-on-background-color, #18251c);
    font-weight: 700;
    text-align: center;
  }

  .product-quantity :deep(.p-button) {
    width: 2rem;
    height: 2rem;
    color: var(--primary-text-color);
  }

  .product-quantity :deep(.p-button:focus-visible) {
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 26%, transparent);
  }

  .category-badge {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    z-index: 1;
    font-size: 0.72rem;
  }

  @media (max-width: 900px) {
    .product-card .product-body {
      justify-content: center;
      align-items: center;
      gap: 0.6rem;
      padding: 0.7rem;
      text-align: center;
    }

    .product-card .category-badge {
      top: 0.4rem;
      right: 0.4rem;
      padding: 0.1rem 0.45rem;
      font-size: 0.6rem;
    }

    .product-card .add-to-cart.p-button {
      min-height: 2.5rem;
      font-size: 0.85rem;
    }

    .product-card .image-price {
      left: 0.4rem;
      bottom: 0.4rem;
      padding: 0;
      font-size: 0.85rem;
    }

    .product-card .product-description {
      font-size: 0.8rem;
      line-height: 1.4;
      max-height: 4.2em;
    }

    .product-card h3 {
      font-size: 1rem;
      overflow-wrap: anywhere;
    }

    .product-card .product-quantity {
      width: 100%;
      gap: 0.3rem;
      padding: 0.35rem 0.4rem;
      font-size: 0.85rem;
    }

    .product-card .product-quantity :deep(.p-button) {
      flex: 0 0 auto;
      width: 1.8rem;
      height: 1.8rem;
    }

  }
</style>