import { computed } from 'vue'
import { getAvailableVariants } from './useProductVariants.js'
import { formatMainPrice, formatWeightHint, getEffectiveUnitPrice } from '../utils/productPricing.js'

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
      return formatMainPrice(product.value)
    }

    const availablePrices = availableVariants.value
      .map((variant) => getEffectiveUnitPrice(product.value, variant))
      .filter(Number.isFinite)
    if (availablePrices.length === 0) return ''

    const firstVariant = availableVariants.value.find((variant) =>
      getEffectiveUnitPrice(product.value, variant) === Math.min(...availablePrices))
    return `${availablePrices.length === 1 ? '' : 'Desde '}${formatMainPrice(product.value, product.value.currency, firstVariant)}`
  })
  const weightHint = computed(() => formatWeightHint(product.value, product.value.currency, singleAvailableVariant.value))

  return {
    actionProduct,
    actionUnavailable,
    availableVariants,
    singleAvailableVariant,
    unitPriceLabel,
    weightHint,
    variantLabel
  }
}
