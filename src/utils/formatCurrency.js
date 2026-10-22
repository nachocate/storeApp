import { ref } from 'vue'

const hasCentsAmount = (amount) => {
  const value = Number(amount)
  return Number.isFinite(value) && Math.abs(value - Math.round(value)) > 1e-9
}

// Reactive so templates re-render when the catalog loads.
const catalogUsesCents = ref(true)

// Whole-number display applies only when no catalog price (products, promotions) has cents.
export const setCatalogPrices = (amounts) => {
  catalogUsesCents.value = amounts.some(hasCentsAmount)
}

export const formatCurrency = (amount, currency = 'ARS') => {
  const value = Number(amount) || 0
  // Derived amounts that do have cents (e.g. percentage discounts) are never rounded away.
  const wholeNumber = !catalogUsesCents.value && !hasCentsAmount(value)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    ...(wholeNumber ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {})
  }).format(value)
}