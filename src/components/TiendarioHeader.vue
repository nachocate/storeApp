<script setup>
import logoUrl from '../assets/logo.svg'
import { ADMIN_URL } from '../config/tiendario.js'
</script>

<template>
  <header class="tiendario-header">
    <a class="brand" href="/" aria-label="Tiendario, inicio">
      <img class="brand-logo" :src="logoUrl" alt="" aria-hidden="true" />
      <span>Tiendario</span>
    </a>
    <Button
      as="a"
      :href="ADMIN_URL"
      label="Mi tienda"
      icon="pi pi-shop"
      class="tiendario-button tiendario-button--primary"
    />
  </header>
</template>

<style scoped>
.tiendario-header {
  display: flex;
  min-height: 5.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--ink);
  font-size: 1.4rem;
  font-weight: 700;
  text-decoration: none;
}

.brand span {
  margin-top: 0.5rem;
}

.brand:focus-visible {
  border-radius: 0.4rem;
  outline: 3px solid var(--tiendario-primary);
  outline-offset: 4px;
}

.brand-logo {
  display: block;
  width: 3rem;
  flex: 0 0 auto;
  object-fit: contain;
}

@media (max-width: 640px) {
  .tiendario-header {
    min-height: 4.5rem;
  }
}
</style>
