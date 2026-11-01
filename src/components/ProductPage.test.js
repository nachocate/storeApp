import { createApp, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ProductPage from './ProductPage.vue'

const render = (props) => {
  const container = document.createElement('div')
  const onVariantChange = vi.fn()
  const app = createApp(ProductPage, { ...props, onVariantChange })
  app.component('Button', {
    props: ['label', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>'
  })
  app.component('Tag', { props: ['value'], template: '<span>{{ value }}</span>' })
  app.component('Message', { template: '<div><slot /></div>' })
  app.component('Skeleton', { template: '<div />' })
  app.mount(container)

  return { app, container, onVariantChange }
}

describe('ProductPage variants', () => {
  it('requires the customer to select a variant before showing purchase actions', async () => {
    const { app, container, onVariantChange } = render({
      product: {
        id: 1,
        name: 'Remera',
        productType: 'VARIANT',
        category: 'Ropa',
        images: [],
        imageFallback: 'accessory',
        currency: 'ARS',
        unitSymbol: 'u',
        description: '',
        variantConfiguration: {
          options: [
            { name: 'Talle', displayType: 'TEXT', values: [{ label: 'S' }, { label: 'M' }] },
            { name: 'Color', displayType: 'TEXT', values: [{ label: 'Negro' }, { label: 'Blanco' }] }
          ],
          variants: [
            {
              id: 44,
              label: 'Talle: S | Color: Negro',
              selections: [{ optionName: 'Talle', value: 'S' }, { optionName: 'Color', value: 'Negro' }],
              pricePerUnit: '32000',
              available: false
            },
            {
              id: 45,
              label: 'Talle: M | Color: Blanco',
              selections: [{ optionName: 'Talle', value: 'M' }, { optionName: 'Color', value: 'Blanco' }],
              pricePerUnit: '35000',
              available: true
            }
          ]
        }
      }
    })

    await nextTick()

    const selectedOptions = [...container.querySelectorAll('.product-variant-value[aria-pressed="true"]')]
    expect(selectedOptions).toHaveLength(0)
    expect(onVariantChange).toHaveBeenLastCalledWith(null)
    expect(container.querySelector('.product-page-actions')).toBeNull()
    app.unmount()
  })

  it('selects an available combination when the customer changes an option', async () => {
    const { app, container, onVariantChange } = render({
      product: {
        id: 1,
        name: 'Remera',
        productType: 'VARIANT',
        category: 'Ropa',
        images: [],
        imageFallback: 'accessory',
        currency: 'ARS',
        unitSymbol: 'u',
        description: '',
        variantConfiguration: {
          options: [
            { name: 'Talle', displayType: 'TEXT', values: [{ label: 'M' }, { label: 'L' }] },
            {
              name: 'Color',
              displayType: 'COLOR_SWATCH',
              values: [
                { label: 'Negro', swatchHex: '#111111' },
                { label: 'Blanco', swatchHex: '#FFFFFF' }
              ]
            }
          ],
          variants: [
            {
              id: 45,
              label: 'Talle: M | Color: Negro',
              selections: [{ optionName: 'Talle', value: 'M' }, { optionName: 'Color', value: 'Negro' }],
              pricePerUnit: '35000',
              available: true
            },
            {
              id: 46,
              label: 'Talle: L | Color: Blanco',
              selections: [{ optionName: 'Talle', value: 'L' }, { optionName: 'Color', value: 'Blanco' }],
              pricePerUnit: '37000',
              available: true
            }
          ]
        }
      }
    })

    const [sizeOptions, colorOptions] = container.querySelectorAll('.product-variant-option')
    sizeOptions.querySelectorAll('button')[1].click()
    await nextTick()

    const updatedWhiteOption = [...colorOptions.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Blanco'))
    expect(updatedWhiteOption.disabled).toBe(false)
    updatedWhiteOption.click()
    await nextTick()

    expect(onVariantChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 46 }))
    expect([...sizeOptions.querySelectorAll('button')].find((button) =>
      button.textContent.includes('L')
    ).getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.product-page-actions')).not.toBeNull()
    app.unmount()
  })
})
