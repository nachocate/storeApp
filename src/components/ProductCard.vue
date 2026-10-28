<script setup>
import { computed, ref, watch } from 'vue'
import { formatCurrency } from '../utils/formatCurrency.js'
import ProductActions from './ProductActions.vue'

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

defineEmits(['change-quantity', 'add-to-cart', 'remove-from-cart', 'open'])

const imageFailed = ref(false)

watch(() => props.product.image, () => {
  imageFailed.value = false
})

const availableVariants = computed(() =>
  (props.product.variantConfiguration?.variants ?? []).filter((variant) => variant.available)
)
const singleAvailableVariant = computed(() =>
  availableVariants.value.length === 1 ? availableVariants.value[0] : null
)
const actionProduct = computed(() => ({
  ...props.product,
  isSoldOut: props.product.productType === 'VARIANT'
    ? availableVariants.value.length === 0
    : props.product.isSoldOut
}))
const actionUnavailable = computed(() =>
  props.product.productType === 'VARIANT' && availableVariants.value.length === 0
    ? false
    : props.unavailable
)
const variantLabel = computed(() => {
  const variant = singleAvailableVariant.value
  if (!variant) return ''

  return variant.label || (variant.selections ?? [])
    .map(({ optionName, value }) => `${optionName}: ${value}`)
    .join(' | ')
})

const unitPriceLabel = computed(() => {
  if (props.product.productType !== 'VARIANT') {
    return `${formatCurrency(props.product.pricePerType, props.product.currency)} / ${props.product.unitSymbol ?? 'u'}`
  }

  const availablePrices = availableVariants.value
    .map((variant) => Number(variant.pricePerUnit))
    .filter(Number.isFinite)
  if (availablePrices.length === 0) return 'Agotado'

  const price = formatCurrency(Math.min(...availablePrices), props.product.currency)
  return `${availablePrices.length === 1 ? '' : 'Desde '}${price} / ${props.product.unitSymbol ?? 'u'}`
})
</script>

<template>
  <Card class="product-card">
    <template #header>
      <img
        v-if="product.image && !imageFailed"
        class="product-image product-image-clickable"
        :src="product.image"
        :alt="product.name"
        loading="lazy"
        @click="$emit('open')"
        @error="imageFailed = true"
      />
      <div v-else class="product-image product-image-fallback product-image-clickable" role="img" :aria-label="`Imagen de ${product.name} no disponible`" @click="$emit('open')">
        <i :class="product.imageFallback === 'pastry' ? 'pi pi-sparkles' : product.imageFallback === 'accessory' ? 'pi pi-gift' : 'pi pi-shopping-bag'" aria-hidden="true"></i>
      </div>
      <Tag :value="product.category" severity="primary" rounded class="category-badge" />
    </template>

    <template #content>
      <div class="product-body">
      <h3>
        <button type="button" class="product-link" @click="$emit('open')">{{ product.name }}</button>
      </h3>
      <div v-if="product.description" class="product-description-container">
        <p class="product-description">{{ product.description }}</p>
        <button
          type="button"
          class="product-description-more"
          :aria-label="`Leer descripción completa de ${product.name}`"
          @click="$emit('open')"
        >
          Ver más...
        </button>
      </div>
      <div class="product-card-actions">
        <p v-if="variantLabel" class="product-variant-label">{{ variantLabel }}</p>
        <p class="product-prices"><strong>{{ unitPriceLabel }}</strong></p>

        <Button
          v-if="product.productType === 'VARIANT' && availableVariants.length > 1"
          class="add-to-cart"
          type="button"
          :disabled="storeClosed"
          label="Elegir opciones"
          icon="pi pi-sliders-h"
          @click="$emit('open')"
        />
        <ProductActions
          v-else
          :product="actionProduct"
          :quantity-label="quantityLabel"
          :store-closed="storeClosed"
          :busy="busy"
          :locked="locked"
          :in-cart="availableVariants.length === 0 && product.productType === 'VARIANT' ? false : inCart"
          :decrease-removes-item="decreaseRemovesItem"
          :unavailable="actionUnavailable"
          :decrease-disabled="decreaseDisabled"
          :increase-disabled="increaseDisabled"
          @change-quantity="$emit('change-quantity', $event)"
          @add-to-cart="$emit('add-to-cart', singleAvailableVariant?.id ?? null)"
          @remove-from-cart="$emit('remove-from-cart', singleAvailableVariant?.id ?? null)"
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

  .product-card h3 {
    width: 100%;
    margin: 0;
    font-size: 1.2rem;
    line-height: 1.3;
    color: #111827;
    text-align: left;
  }

  .product-card .product-link {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
  }

  .product-card .product-link:hover {
    text-decoration: underline;
  }

  .product-card .product-link:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .product-card-actions {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: auto;
  }

  .product-prices {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
    color: #111827;
  }

  .product-prices strong {
    font-size: 1.15rem;
  }

  .product-variant-label {
    width: 100%;
    margin: 0;
    color: #4b5563;
    font-size: inherit;
    line-height: 1.5;
    text-align: left;
  }

  .product-card .add-to-cart.p-button {
    width: 100%;
    min-height: 3rem;
    margin-top: 0;
    border-radius: 12px;
    font-weight: 700;
  }

  .product-card-actions :deep(.product-quantity) {
    margin-top: 0;
  }

  .product-image-clickable {
    cursor: pointer;
  }

  .product-description {
    margin: 0;
    display: -webkit-box;
    overflow: hidden;
    color: #4b5563;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    text-align: left;
    width: 100%;
  }

  .product-description-container {
    width: 100%;
    text-align: left;
  }

  .product-description-more {
    padding: 0;
    border: 0;
    background: none;
    color: var(--primary-color);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .product-description-more:hover {
    text-decoration: underline;
  }

  .product-description-more:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
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

    .product-card .product-card-actions {
      gap: 0.6rem;
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

    .product-card .product-description,
    .product-card .product-variant-label {
      font-size: 0.8rem;
      line-height: 1.4;
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