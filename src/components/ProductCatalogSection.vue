<script setup>
import ProductCard from './ProductCard.vue'
import PromotionsCarousel from './PromotionsCarousel.vue'

defineProps({
  cards: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  storeNotFound: { type: Boolean, default: false },
  error: { type: String, default: '' },
  promotionError: { type: String, default: '' },
  promotions: { type: Array, default: () => [] },
  busyPromotionId: { type: [String, Number], default: null },
  cartLoading: { type: Boolean, default: false },
  storeClosed: { type: Boolean, default: false },
  filteredProductCount: { type: Number, default: 0 },
  hasMore: { type: Boolean, default: false },
  settingsLoading: { type: Boolean, default: false },
  moreError: { type: String, default: '' },
  loadingMore: { type: Boolean, default: false }
})

const emit = defineEmits([
  'retry',
  'clear-promotion-error',
  'add-promotion',
  'load-more',
  'sentinel-change',
  'change-quantity',
  'add-to-cart',
  'remove-from-cart',
  'open-product'
])

const setLoadMoreSentinel = (element) => emit('sentinel-change', element)
</script>

<template>
  <section id="products" class="products-grid">
    <div v-if="loading || storeNotFound" class="product-skeleton-grid" role="status" aria-label="Cargando productos">
      <Card v-for="placeholder in 8" :key="placeholder" class="skeleton-product-card" aria-hidden="true">
        <template #header><Skeleton class="skeleton-product-image" /></template>
        <template #content>
          <div class="skeleton-product-body">
            <div class="skeleton-meta-row">
              <Skeleton width="5rem" height="1.5rem" />
              <Skeleton width="4rem" height="1rem" />
            </div>
            <Skeleton width="75%" height="1.4rem" />
            <div class="skeleton-description">
              <Skeleton width="100%" height="0.8rem" />
              <Skeleton width="68%" height="0.8rem" />
            </div>
            <Skeleton width="100%" height="2.75rem" />
            <div class="skeleton-footer">
              <Skeleton width="5rem" height="1.8rem" />
              <Skeleton width="7rem" height="2.8rem" />
            </div>
          </div>
        </template>
      </Card>
    </div>
    <div v-else-if="error" class="empty-state">
      <Message severity="error" :closable="false">{{ error }}</Message>
      <Button label="Reintentar" icon="pi pi-refresh" @click="emit('retry')" />
    </div>
    <Message
      v-if="promotionError && promotions.length"
      severity="error"
      class="promotions-section"
      @close="emit('clear-promotion-error')"
    >
      {{ promotionError }}
    </Message>
    <PromotionsCarousel
      v-if="promotions.length && !error"
      class="promotions-section"
      :promotions="promotions"
      :busy-promotion-id="busyPromotionId"
      :locked="cartLoading"
      :store-closed="storeClosed"
      @add-bundle="emit('add-promotion', $event)"
    />
    <h2
      v-if="promotions.length && !error && !loading && filteredProductCount"
      class="products-title"
    >
      Productos
    </h2>
    <Message
      v-if="!loading && !storeNotFound && !error && filteredProductCount === 0"
      severity="info"
      :closable="false"
      class="empty-state"
    >
      No se encontraron productos.
    </Message>
    <ProductCard
      v-for="card in cards"
      :key="card.product.id"
      :product="card.product"
      :quantity-label="card.quantityLabel"
      :store-closed="card.storeClosed"
      :busy="card.busy"
      :locked="card.locked"
      :in-cart="card.inCart"
      :decrease-removes-item="card.decreaseRemovesItem"
      :unavailable="card.unavailable"
      :decrease-disabled="card.decreaseDisabled"
      :increase-disabled="card.increaseDisabled"
      @change-quantity="emit('change-quantity', { product: card.product, variantId: card.variantId, delta: $event })"
      @add-to-cart="emit('add-to-cart', { product: card.product, variantId: $event })"
      @remove-from-cart="emit('remove-from-cart', { product: card.product, variantId: $event })"
      @open="emit('open-product', card.product)"
    />
    <div v-if="hasMore && !storeNotFound && !settingsLoading" class="load-more-region">
      <Message v-if="moreError" severity="error" :closable="false">{{ moreError }}</Message>
      <Button
        v-else
        label="Cargar más productos"
        icon="pi pi-chevron-down"
        :loading="loadingMore"
        @click="emit('load-more')"
      />
      <span :ref="setLoadMoreSentinel" class="load-more-sentinel" aria-hidden="true"></span>
    </div>
  </section>
</template>

<style scoped>
  .products-grid {
    width: clamp(300px, 90vw, var(--content-max-width));
    display: grid;
    gap: 1rem;
    padding: 0;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  .promotions-section,
  .products-title,
  .product-skeleton-grid,
  .load-more-region {
    grid-column: 1 / -1;
    min-width: 0;
  }

  .products-title {
    margin: 0.5rem 0 0;
    color: var(--primary-text-color);
    font-size: 1.35rem;
  }

  .product-skeleton-grid {
    display: grid;
    width: 100%;
    grid-template-columns: inherit;
    gap: 1rem;
  }

  .product-skeleton-grid :deep(.p-skeleton) {
    background: #e5e7eb;
  }

  .product-skeleton-grid :deep(.p-skeleton)::after {
    background: linear-gradient(90deg, transparent, #f3f4f6, transparent);
  }

  .skeleton-product-card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    box-shadow: none;
  }

  .skeleton-product-card :deep(.p-card-body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 0;
  }

  .skeleton-product-card :deep(.p-card-header),
  .skeleton-product-card :deep(.p-card-content) {
    padding: 0;
  }

  .skeleton-product-card :deep(.p-card-content) {
    display: flex;
    flex: 1;
  }

  .skeleton-product-image {
    width: 100%;
    height: 220px;
    flex: 0 0 auto;
    border-radius: 0;
  }

  .skeleton-product-body {
    display: flex;
    min-height: 100%;
    flex: 1;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1rem;
  }

  .skeleton-meta-row,
  .skeleton-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .skeleton-description {
    display: grid;
    gap: 0.45rem;
    min-height: 48px;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    border-radius: 16px;
    border: 2px solid var(--secondary-color);
    background: rgba(255, 255, 255, 0.8);
    color: #555;
    font-weight: 600;
  }

  .load-more-region {
    position: relative;
    display: grid;
    min-height: 3.5rem;
    place-items: center;
    padding: 0.5rem;
  }

  .load-more-region :deep(.p-button) {
    min-width: 13rem;
  }

  .load-more-sentinel {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }

  @media (min-width: 500px) and (max-width: 900px) {
    .products-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 499px) {
    .products-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
    }

    .skeleton-product-image {
      height: 150px;
    }

    .skeleton-product-body {
      padding: 0.7rem;
    }
  }
</style>
