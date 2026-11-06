import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'

const sortOptions = [
  { value: 'name-asc', label: 'Nombre A-Z', icon: 'pi pi-sort-alpha-up' },
  { value: 'name-desc', label: 'Nombre Z-A', icon: 'pi pi-sort-alpha-down' },
  { value: 'price-asc', label: 'Precio menor a mayor', icon: 'pi pi-sort-amount-up' },
  { value: 'price-desc', label: 'Precio mayor a menor', icon: 'pi pi-sort-amount-down' }
]

export const useProductCatalog = ({
  products,
  categoryData,
  promotions,
  productsLoading,
  storeNotFound,
  branding,
  storeSecondaryContrastColor,
  fallbackSecondaryColor
}) => {
  const categories = computed(() => {
    const names = categoryData.value.length
      ? categoryData.value.map((category) => category.name).filter(Boolean)
      : products.filter((product) => product.isVisible).map((product) => product.category)
    return [...new Set(names)]
  })

  const search = ref('')
  const selectedCategory = ref('')
  const sortOption = ref(sortOptions.find((option) => option.value === 'name-asc'))
  const sortSelectPt = computed(() => {
    const secondaryColor = branding.secondaryColor || fallbackSecondaryColor

    return {
      option: ({ context }) => context.selected
        ? {
            style: {
              backgroundColor: secondaryColor,
              color: storeSecondaryContrastColor.value,
              fontWeight: '700'
            }
          }
        : undefined
    }
  })

  const categoryPillsEl = ref(null)
  const categoryScroll = reactive({ canScrollBack: false, canScrollForward: false })
  let categoryResizeObserver = null

  const updateCategoryScroll = () => {
    const el = categoryPillsEl.value
    if (!el) return
    categoryScroll.canScrollBack = el.scrollLeft > 1
    categoryScroll.canScrollForward = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  }

  const scrollCategories = (direction) => {
    const el = categoryPillsEl.value
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  const focusSelectedCategory = () => {
    const selected = categoryPillsEl.value?.querySelector('.category-pill.selected')
    selected?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  const toggleCategory = (category) => {
    selectedCategory.value = selectedCategory.value === category ? '' : category
    nextTick(focusSelectedCategory)
  }

  watch(categoryPillsEl, (el) => {
    categoryResizeObserver?.disconnect()
    categoryResizeObserver = null
    if (!el) return
    updateCategoryScroll()
    if (typeof ResizeObserver !== 'undefined') {
      categoryResizeObserver = new ResizeObserver(updateCategoryScroll)
      categoryResizeObserver.observe(el)
    }
  })
  watch(categories, () => nextTick(updateCategoryScroll))
  onBeforeUnmount(() => categoryResizeObserver?.disconnect())

  const filteredProducts = computed(() => {
    const term = search.value.trim().toLocaleLowerCase('es')

    return products.filter((product) => {
      const matchesCategory = !selectedCategory.value || selectedCategory.value === product.category
      const matchesSearch =
        !term ||
        product.name.toLocaleLowerCase('es').includes(term) ||
        product.category.toLocaleLowerCase('es').includes(term)

      return product.isVisible && matchesCategory && matchesSearch
    })
  })

  const visiblePromotions = computed(() => {
    if (selectedCategory.value || productsLoading.value || storeNotFound.value) return []
    const term = search.value.trim().toLocaleLowerCase('es')
    return term
      ? promotions.value.filter((promotion) => promotion.name.toLocaleLowerCase('es').includes(term))
      : promotions.value
  })

  const sortedProducts = computed(() => {
    const [field, direction] = sortOption.value.value.split('-')
    const sorted = [...filteredProducts.value]
    sorted.sort((first, second) => {
      const comparison = field === 'name'
        ? first.name.localeCompare(second.name, 'es', { sensitivity: 'base' })
        : first.pricePerType - second.pricePerType
      return direction === 'desc' ? -comparison : comparison
    })
    return sorted
  })

  return {
    categories,
    categoryPillsEl,
    categoryScroll,
    filteredProducts,
    search,
    scrollCategories,
    selectedCategory,
    sortOption,
    sortOptions,
    sortSelectPt,
    sortedProducts,
    toggleCategory,
    updateCategoryScroll,
    visiblePromotions
  }
}
