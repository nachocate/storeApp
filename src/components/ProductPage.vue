<script setup>
import { computed, watch } from 'vue'
import { formatMainPrice, formatWeightHint, getEffectiveUnitPrice } from '../utils/productPricing.js'
import ProductActions from './ProductActions.vue'
import ProductGallery from './ProductGallery.vue'
import { useProductVariants } from '../composables/useProductVariants.js'

const props = defineProps({
  product: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  quantityLabel: { type: String, default: '' },
  storeClosed: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  inCart: { type: Boolean, default: false },
  decreaseRemovesItem: { type: Boolean, default: false },
  unavailable: { type: Boolean, default: false },
  decreaseDisabled: { type: Boolean, default: false },
  increaseDisabled: { type: Boolean, default: false }
})

const emit = defineEmits(['back', 'retry', 'change-quantity', 'add-to-cart', 'remove-from-cart', 'variant-change'])

const {
  canSelectValue,
  selectedOptions,
  selectedVariant,
  selectOption,
  variantOptions,
  variants
} = useProductVariants(() => props.product)
watch(selectedVariant, (variant) => emit('variant-change', variant), { immediate: true })

const actionProduct = computed(() => {
  if (!props.product) return null
  if (!selectedVariant.value) return props.product

  return {
    ...props.product,
    pricePerType: getEffectiveUnitPrice(props.product, selectedVariant.value),
    maxQuantityPerOrder: selectedVariant.value.maxQuantityPerOrder == null
      ? props.product.maxQuantityPerOrder
      : Number(selectedVariant.value.maxQuantityPerOrder),
    isSoldOut: !selectedVariant.value.available,
    variantId: selectedVariant.value.id
  }
})

const unitPriceLabel = computed(() => {
  if (!props.product) return ''
  if (props.product.productType === 'VARIANT') {
    return selectedVariant.value
      ? formatMainPrice(props.product, props.product.currency, selectedVariant.value)
      : 'Elegí las opciones para ver el precio'
  }
  return formatMainPrice(props.product)
})

const weightHint = computed(() => formatWeightHint(props.product, props.product.currency, selectedVariant.value))

const fallbackIcon = computed(() => props.product?.imageFallback === 'pastry'
  ? 'pi pi-sparkles'
  : props.product?.imageFallback === 'accessory' ? 'pi pi-gift' : 'pi pi-shopping-bag')
</script>

<template>
  <div class="product-page">
    <div class="product-page-inner">
      <Button
        class="back-link"
        type="button"
        icon="pi pi-arrow-left"
        label="Volver a la tienda"
        text
        @click="$emit('back')"
      />

      <div v-if="loading" class="product-page-layout" role="status" aria-label="Cargando producto">
        <Skeleton class="product-page-skeleton-image" />
        <div class="product-page-info">
          <Skeleton width="60%" height="2rem" />
          <Skeleton width="30%" height="1.5rem" />
          <Skeleton height="6rem" />
        </div>
      </div>

      <Message v-else-if="error" severity="error" :closable="false">
        <div class="product-page-message">
          <span>{{ error }}</span>
          <Button label="Reintentar" icon="pi pi-refresh" size="small" @click="$emit('retry')" />
        </div>
      </Message>

      <Message v-else-if="!product" severity="info" :closable="false">
        No encontramos este producto. Puede que ya no esté disponible.
      </Message>

      <article v-else class="product-page-layout">
        <ProductGallery :images="product.images" :alt="product.name" :fallback-icon="fallbackIcon" />
        <div class="product-page-info">
          <Tag :value="product.category" severity="primary" rounded class="product-page-category" />
          <h1>{{ product.name }}</h1>
          <p class="product-page-price">{{ unitPriceLabel }}</p>
          <p v-if="weightHint" class="product-page-weight-hint">{{ weightHint }}</p>
          <p v-if="product.description" class="product-page-description">{{ product.description }}</p>
          <p v-else class="product-page-description product-page-description-empty">
            Este producto todavía no tiene descripción.
          </p>
          <div v-if="product.productType === 'VARIANT'" class="product-variant-options">
            <fieldset v-for="(option, optionIndex) in variantOptions" :key="option.name" class="product-variant-option">
              <legend>{{ option.name }}</legend>
              <div class="product-variant-values">
                <button
                  v-for="value in option.values"
                  :key="value.label"
                  type="button"
                  class="product-variant-value"
                  :class="{
                    selected: selectedOptions[option.name] === value.label,
                    'color-swatch': option.displayType === 'COLOR_SWATCH'
                  }"
                  :disabled="!canSelectValue(optionIndex, option, value)"
                  :aria-pressed="selectedOptions[option.name] === value.label"
                  @click="selectOption(optionIndex, option, value)"
                >
                  <span
                    v-if="option.displayType === 'COLOR_SWATCH'"
                    class="product-variant-swatch"
                    :style="{ backgroundColor: /^#[0-9a-f]{6}$/i.test(value.swatchHex ?? '') ? value.swatchHex : '#e5e7eb' }"
                    aria-hidden="true"
                  ></span>
                  {{ value.label }}
                </button>
              </div>
            </fieldset>
            <Message v-if="!variants.some((variant) => variant.available)" severity="warn" :closable="false">
              No hay combinaciones disponibles por el momento.
            </Message>
            <p v-else-if="variantOptions.length && !selectedVariant" class="product-variant-hint" role="status">
              Seleccioná una opción disponible de cada tipo.
            </p>
          </div>
          <ProductActions
            v-if="product.productType !== 'VARIANT' || selectedVariant"
            class="product-page-actions"
            :product="actionProduct"
            :quantity-label="quantityLabel"
            :store-closed="storeClosed"
            :busy="busy"
            :locked="locked"
            :in-cart="inCart"
            :decrease-removes-item="decreaseRemovesItem"
            :unavailable="unavailable"
            :decrease-disabled="decreaseDisabled"
            :increase-disabled="increaseDisabled"
            @change-quantity="emit('change-quantity', { delta: $event, variantId: selectedVariant?.id ?? null })"
            @add-to-cart="emit('add-to-cart', selectedVariant?.id ?? null)"
            @remove-from-cart="emit('remove-from-cart', selectedVariant?.id ?? null)"
          />
          <p v-if="storeClosed" class="product-page-closed" role="status">
            La tienda se encuentra cerrada en este momento.
          </p>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
  .product-page {
    position: fixed;
    inset: 0;
    z-index: 20;
    overflow-y: auto;
    background: var(--background-color);
    color: var(--primary-on-background-color);
  }

  .product-page-inner {
    width: min(100% - 2rem, var(--content-max-width, 64rem));
    margin: 0 auto;
    padding: 1rem 0 6rem;
  }

  .back-link {
    margin-bottom: 0.75rem;
  }

  :deep(.p-button.back-link),
  :deep(.p-button.back-link:not(:disabled):hover),
  :deep(.p-button.back-link:not(:disabled):active) {
    --p-button-text-primary-color: var(--primary-color);
    --p-button-text-primary-hover-background: transparent;
    --p-button-text-primary-active-background: transparent;
    gap: 0.55rem;
    padding: 0.4rem 0;
    border: 0;
    background: transparent;
    color: var(--primary-color);
    font: inherit;
    font-weight: 700;
    box-shadow: none;
    transform: none;
  }

  .product-page-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }

  .product-page-skeleton-image {
    width: 100%;
    aspect-ratio: 1 / 1;
    height: auto;
    border-radius: 20px;
  }

  .product-page-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.9rem;
  }

  .product-page-info h1 {
    margin: 0;
    font-size: 1.8rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .product-page-price {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
  }

  .product-page-weight-hint {
    margin: -0.45rem 0 0;
    color: #526157;
    font-size: 0.9rem;
  }

  .product-page-description {
    margin: 0;
    line-height: 1.6;
    white-space: pre-line;
  }

  .product-page-description-empty {
    opacity: 0.7;
  }

  .product-variant-options {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 1rem;
  }

  .product-variant-option {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .product-variant-option legend {
    margin-bottom: 0.5rem;
    font-weight: 700;
  }

  .product-variant-values {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .product-variant-value {
    display: inline-flex;
    min-height: 2.5rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--primary-on-background-color) 25%, transparent);
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .product-variant-value.selected {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
  }

  .product-variant-value:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .product-variant-swatch {
    width: 1rem;
    height: 1rem;
    border: 1px solid color-mix(in srgb, var(--primary-on-background-color) 25%, transparent);
    border-radius: 50%;
  }

  .product-variant-hint {
    margin: 0;
    opacity: 0.75;
  }

  .product-page-actions {
    align-self: stretch;
    margin-top: 0.5rem;
  }

  .product-page-closed {
    margin: 0;
    font-weight: 700;
  }

  .product-page-message {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  @media (min-width: 800px) {
    .product-page-layout {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
      gap: 2.5rem;
    }
  }
</style>
