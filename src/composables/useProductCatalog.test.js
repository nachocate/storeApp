import { createApp, h, reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useProductCatalog } from './useProductCatalog.js'

const mountCatalog = (options) => {
  const container = document.createElement('div')
  let catalog
  const app = createApp({
    setup() {
      catalog = useProductCatalog(options)
      return () => h('div')
    }
  })
  app.mount(container)

  return { app, catalog }
}

describe('useProductCatalog', () => {
  it('filters and sorts visible products and promotions', () => {
    const products = reactive([
      { id: 1, name: 'Banana', category: 'Fruta', pricePerType: 20, isVisible: true },
      { id: 2, name: 'Manzana', category: 'Fruta', pricePerType: 10, isVisible: true },
      { id: 3, name: 'Oculto', category: 'Fruta', pricePerType: 5, isVisible: false }
    ])
    const promotions = ref([
      { id: 1, name: 'Combo fruta' },
      { id: 2, name: 'Combo desayuno' }
    ])
    const { app, catalog } = mountCatalog({
      products,
      categoryData: ref([]),
      promotions,
      productsLoading: ref(false),
      storeNotFound: ref(false),
      branding: reactive({ secondaryColor: '#123456' }),
      storeSecondaryContrastColor: ref('#ffffff'),
      fallbackSecondaryColor: '#eeeeee'
    })

    expect(catalog.categories.value).toEqual(['Fruta'])
    expect(catalog.sortedProducts.value.map((product) => product.name)).toEqual(['Banana', 'Manzana'])

    catalog.sortOption.value = catalog.sortOptions.find((option) => option.value === 'price-asc')
    expect(catalog.sortedProducts.value.map((product) => product.name)).toEqual(['Manzana', 'Banana'])

    catalog.search.value = 'fruta'
    expect(catalog.visiblePromotions.value.map((promotion) => promotion.name)).toEqual(['Combo fruta'])
    catalog.search.value = 'banana'
    catalog.toggleCategory('Fruta')
    expect(catalog.filteredProducts.value.map((product) => product.name)).toEqual(['Banana'])
    expect(catalog.visiblePromotions.value).toEqual([])

    app.unmount()
  })
})
