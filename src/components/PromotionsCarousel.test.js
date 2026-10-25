import { createApp } from 'vue'
import { describe, expect, it } from 'vitest'
import PromotionsCarousel from './PromotionsCarousel.vue'

const render = (promotions) => {
  const container = document.createElement('div')
  const app = createApp(PromotionsCarousel, { promotions })
  app.component('Tag', { template: '<span><slot /></span>' })
  app.component('Button', { template: '<button><slot /></button>' })
  app.mount(container)

  return { app, container }
}

const promotion = (id) => ({
  id,
  name: `Promoción ${id}`,
  description: '',
  products: [],
  discountPercent: null,
  discountAmount: 0,
  totalAmount: null,
  originalAmount: null,
  currency: 'ARS',
  image: '',
  bundleAddable: false
})

describe('PromotionsCarousel', () => {
  it('centers a single promotion in the product-card width layout', () => {
    const { app, container } = render([promotion(1)])

    expect(container.querySelector('.promotions-track').classList.contains('promotions-track-single')).toBe(true)

    app.unmount()
  })

  it('keeps multiple promotions in the carousel layout', () => {
    const { app, container } = render([promotion(1), promotion(2)])

    expect(container.querySelector('.promotions-track').classList.contains('promotions-track-single')).toBe(false)

    app.unmount()
  })
})
