const DEFAULT_DECIMAL_SCALE = 3

const toPositiveNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export const roundQuantity = (value, decimalScale = DEFAULT_DECIMAL_SCALE) =>
  Number(Number(value).toFixed(decimalScale))

// The API defines how each product is sold; without it, whole units are assumed.
export const readQuantityRules = (product) => {
  const soldByUnit = product.pricingMode === 'WEIGHT_BASED_UNIT_PRICE'
  const decimalScale = Number.isInteger(product.unit?.decimalScale) && product.unit.decimalScale >= 0
    ? product.unit.decimalScale
    : 0
  const saleUnit = product.saleUnit ?? product.unit ?? {}
  const saleDecimalScale = soldByUnit
    ? 0
    : Number.isInteger(saleUnit.decimalScale) && saleUnit.decimalScale >= 0
      ? saleUnit.decimalScale
      : decimalScale
  const step = toPositiveNumber(product.quantityIncrement) ?? (saleDecimalScale > 0 ? 0.25 : 1)
  const minQuantity = toPositiveNumber(product.minimumPurchaseQuantity) ?? step

  return {
    decimalScale: saleDecimalScale,
    step: roundQuantity(step, Math.max(saleDecimalScale, DEFAULT_DECIMAL_SCALE)),
    minQuantity: roundQuantity(minQuantity, Math.max(saleDecimalScale, DEFAULT_DECIMAL_SCALE)),
    unitSymbol: saleUnit.symbol || 'u',
    unitName: saleUnit.name ?? ''
  }
}

export const formatQuantity = (quantity, { unitSymbol = 'u', decimalScale = 0 } = {}) => {
  const value = Number(quantity)
  if (unitSymbol === 'kg' && value < 1) return `${Math.round(value * 1000)} g`
  return `${Number(value.toFixed(decimalScale))} ${unitSymbol}`
}
