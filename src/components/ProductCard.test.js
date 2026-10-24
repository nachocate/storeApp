import { createApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ProductCard from './ProductCard.vue'

const render = (props) => {
  const container = document.createElement('div')
  const onOpen = vi.fn()
  const app = createApp(ProductCard, { ...props, onOpen })
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

  return { app, container, onOpen }
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

  it('opens the product page to choose a variant', () => {
    const { app, container, onOpen } = render({
      product: {
        id: 'shirt',
        name: 'Remera',
        productType: 'VARIANT',
        variantConfiguration: { variants: [{ available: true, pricePerUnit: '1000' }] },
        currency: 'ARS',
        unitSymbol: 'u'
      },
      quantityLabel: '1 u'
    })

    container.querySelector('.add-to-cart').click()

    expect(onOpen).toHaveBeenCalledOnce()
    app.unmount()
  })
})
