import { createApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ProductCatalogSection from './ProductCatalogSection.vue'

describe('ProductCatalogSection', () => {
  it('emits a retry action from the product error state', () => {
    const container = document.createElement('div')
    const onRetry = vi.fn()
    const app = createApp(ProductCatalogSection, {
      error: 'No se pudieron cargar los productos.',
      onRetry
    })
    app.component('Message', { template: '<div><slot /></div>' })
    app.component('Button', {
      props: ['label'],
      emits: ['click'],
      template: '<button @click="$emit(\'click\')">{{ label }}</button>'
    })
    app.mount(container)

    container.querySelector('button').click()

    expect(container.textContent).toContain('No se pudieron cargar los productos.')
    expect(onRetry).toHaveBeenCalledOnce()
    app.unmount()
  })
})
