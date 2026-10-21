const DEFAULT_DECIMAL_SCALE = 3

const toPositiveNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export const roundQuantity = (value, decimalScale = DEFAULT_DECIMAL_SCALE) =>
  Number(Number(value).toFixed(decimalScale))

// The API defines how each product is sold; without it, whole units are assumed.
export const readQuantityRules = (product) => {
  const decimalScale = Number.isInteger(product.unit?.decimalScale) && product.unit.decimalScale >= 0
    ? product.unit.decimalScale
    : 0
  const step = toPositiveNumber(product.quantityIncrement) ?? (decimalScale > 0 ? 0.25 : 1)
  const minQuantity = toPositiveNumber(product.minimumPurchaseQuantity) ?? step

  return {
    decimalScale,
    step: roundQuantity(step, Math.max(decimalScale, DEFAULT_DECIMAL_SCALE)),
    minQuantity: roundQuantity(minQuantity, Math.max(decimalScale, DEFAULT_DECIMAL_SCALE)),
    unitSymbol: product.unit?.symbol || 'u',
    unitName: product.unit?.name ?? ''
  }
}

export const formatQuantity = (quantity, { unitSymbol = 'u', decimalScale = 0 } = {}) => {
  const value = Number(quantity)
  if (unitSymbol === 'kg' && value < 1) return `${Math.round(value * 1000)} g`
  return `${Number(value.toFixed(decimalScale))} ${unitSymbol}`
}
