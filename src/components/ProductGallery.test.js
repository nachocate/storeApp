import { createApp } from 'vue'
import { describe, expect, it } from 'vitest'
import ProductGallery from './ProductGallery.vue'

const render = (images) => {
  const container = document.createElement('div')
  createApp(ProductGallery, { images, alt: 'Manzana' }).mount(container)
  return container
}

describe('ProductGallery', () => {
  it('renders a plain image without carousel controls when there is one image', () => {
    const container = render(['/a.jpg'])

    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('.gallery-arrow')).toBeNull()
    expect(container.querySelector('.gallery-dots')).toBeNull()
  })

  it('renders a carousel with controls when there are several images', () => {
    const container = render(['/a.jpg', '/b.jpg', '/c.jpg'])

    expect(container.querySelectorAll('img')).toHaveLength(3)
    expect(container.querySelectorAll('.gallery-dot')).toHaveLength(3)
    expect(container.querySelector('[aria-label="Imagen siguiente"]')).not.toBeNull()
  })

  it('shows a fallback when there are no images', () => {
    const container = render([])

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[role="img"]')).not.toBeNull()
  })
})
