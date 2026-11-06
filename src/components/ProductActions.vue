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
const hoveredQuantityControl = ref('')

watch(() => [props.inCart, props.busy], ([inCart, busy]) => {
  if (!busy) displayInCart.value = inCart
}, { immediate: true })

const addAriaLabel = computed(() => props.busy
  ? 'Procesando producto'
  : props.unavailable || props.product.isSoldOut
    ? `No disponible ${props.product.name}`
    : props.inCart
      ? `Añadido ${props.product.name}`
      : `Añadir ${props.product.name}`)
</script>

<template>
  <Button
    v-if="!storeClosed && (!displayInCart || unavailable || product.isSoldOut)"
    class="add-to-cart"
    type="button"
    :label="unavailable || product.isSoldOut ? 'No disponible' : 'Agregar al carrito'"
    icon="pi pi-cart-plus"
    :disabled="busy || locked || unavailable || product.isSoldOut"
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
</template>

<style scoped>
  .add-to-cart.p-button {
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

  .product-quantity :deep(.p-button) {
    width: 2rem;
    height: 2rem;
    color: var(--primary-text-color);
  }

  .product-quantity :deep(.p-button:focus-visible) {
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 26%, transparent);
  }
</style>
