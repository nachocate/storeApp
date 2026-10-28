import { createApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ProductCard from './ProductCard.vue'

const render = (props) => {
  const container = document.createElement('div')
  const onOpen = vi.fn()
  const onAddToCart = vi.fn()
  const app = createApp(ProductCard, { ...props, onOpen, onAddToCart })
  app.component('Card', {
    template: '<div><slot name="header" /><slot name="content" /></div>'
  })
  app.component('Tag', { template: '<span><slot /></span>' })
  app.component('Button', {
    props: ['label'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')">{{ label }}</button>'
  })
  app.mount(container)

  return { app, container, onOpen, onAddToCart }
}

describe('ProductCard', () => {
  it('opens the product page from the read-more control', () => {
    const { app, container, onOpen } = render({
      product: {
        id: 'product-1',
        name: 'Manzana',
        description: 'Una descripción extensa del producto.',
        pricePerType: 10
      },
      quantityLabel: '1 u'
    })

    container.querySelector('.product-description-more').click()

    expect(onOpen).toHaveBeenCalledOnce()
    app.unmount()
  })

  it('opens the product page when multiple variants are available', () => {
    const { app, container, onOpen } = render({
      product: {
        id: 'shirt',
        name: 'Remera',
        productType: 'VARIANT',
        variantConfiguration: {
          variants: [
            { id: 1, available: true, pricePerUnit: '1000' },
            { id: 2, available: true, pricePerUnit: '1200' }
          ]
        },
        currency: 'ARS',
        unitSymbol: 'u'
      },
      quantityLabel: '1 u'
    })

    container.querySelector('.add-to-cart').click()

    expect(onOpen).toHaveBeenCalledOnce()
    app.unmount()
  })

  it('shows an unavailable button when no variants are available', () => {
    const { app, container } = render({
      product: {
        id: 'shirt',
        name: 'Remera',
        productType: 'VARIANT',
        variantConfiguration: { variants: [{ id: 1, available: false }] }
      },
      quantityLabel: '1 u'
    })

    const button = container.querySelector('.add-to-cart')
    expect(container.querySelector('.product-prices')).toBeNull()
    expect(button.textContent).toBe('No disponible')
    expect(button.disabled).toBe(true)
    app.unmount()
  })

  it('shows the same unavailable button for unavailable simple products', () => {
    const { app, container } = render({
      product: {
        id: 'apple',
        name: 'Manzana',
        pricePerType: 10,
        currency: 'ARS',
        isSoldOut: true
      },
      quantityLabel: '1 u',
      unavailable: true
    })

    const button = container.querySelector('.add-to-cart')
    expect(button.textContent).toBe('No disponible')
    expect(button.disabled).toBe(true)
    app.unmount()
  })

  it('shows and adds the only available variant directly from the card', () => {
    const { app, container, onAddToCart } = render({
      product: {
        id: 'shirt',
        name: 'Remera',
        productType: 'VARIANT',
        variantConfiguration: {
          variants: [
            {
              id: 7,
              label: 'Talle: M | Color: Negro',
              available: true,
              pricePerUnit: '1000'
            },
            { id: 8, label: 'Talle: L | Color: Blanco', available: false, pricePerUnit: '1200' }
          ]
        },
        currency: 'ARS',
        unitSymbol: 'u'
      },
      quantityLabel: '1 u'
    })

    expect(container.textContent).toContain('Talle: M | Color: Negro')
    const button = container.querySelector('.add-to-cart')
    expect(button.textContent).toBe('Agregar al carrito')
    button.click()

    expect(onAddToCart).toHaveBeenCalledWith(7)
    app.unmount()
  })
})
