import { computed } from 'vue'
import { formatCurrency } from '../utils/formatCurrency.js'
import { getAvailableVariants } from './useProductVariants.js'

export const useProductCard = (getProduct, getUnavailable) => {
  const product = computed(getProduct)
  const availableVariants = computed(() => getAvailableVariants(product.value))
  const singleAvailableVariant = computed(() =>
    availableVariants.value.length === 1 ? availableVariants.value[0] : null
  )

  const actionProduct = computed(() => ({
    ...product.value,
    isSoldOut: product.value.productType === 'VARIANT'
      ? availableVariants.value.length === 0
      : product.value.isSoldOut
  }))
  const actionUnavailable = computed(() =>
    product.value.productType === 'VARIANT' && availableVariants.value.length === 0
      ? false
      : getUnavailable()
  )
  const variantLabel = computed(() => {
    const variant = singleAvailableVariant.value
    if (!variant) return ''

    return variant.label || (variant.selections ?? [])
      .map(({ optionName, value }) => `${optionName}: ${value}`)
      .join(' | ')
  })
  const unitPriceLabel = computed(() => {
    if (product.value.productType !== 'VARIANT') {
      return `${formatCurrency(product.value.pricePerType, product.value.currency)} / ${product.value.unitSymbol ?? 'u'}`
    }

    const availablePrices = availableVariants.value
      .map((variant) => Number(variant.pricePerUnit))
      .filter(Number.isFinite)
    if (availablePrices.length === 0) return ''

    const price = formatCurrency(Math.min(...availablePrices), product.value.currency)
    return `${availablePrices.length === 1 ? '' : 'Desde '}${price} / ${product.value.unitSymbol ?? 'u'}`
  })

  return {
    actionProduct,
    actionUnavailable,
    availableVariants,
    singleAvailableVariant,
    unitPriceLabel,
    variantLabel
  }
}
