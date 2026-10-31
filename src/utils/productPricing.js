import { formatCurrency } from './formatCurrency.js'

export const WEIGHT_BASED_UNIT_PRICE = 'WEIGHT_BASED_UNIT_PRICE'

export const isWeightBasedUnitPrice = (product) =>
  product?.pricingMode === WEIGHT_BASED_UNIT_PRICE

const readNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const getEffectiveUnitPrice = (product, variant = null) => {
  const value = variant?.pricePerUnit ??
    (isWeightBasedUnitPrice(product) ? product?.effectiveUnitPrice : product?.pricePerUnit) ??
    product?.pricePerType
  return readNumber(value)
}

export const getSaleUnit = (product) => product?.saleUnit ?? product?.unit ?? {}

export const getSaleUnitSymbol = (product) => getSaleUnit(product).symbol || product?.unitSymbol || 'u'

export const getSaleUnitDecimalScale = (product) => {
  if (isWeightBasedUnitPrice(product)) return 0
  const scale = Number(getSaleUnit(product).decimalScale ?? product?.decimalScale)
  return Number.isInteger(scale) && scale >= 0 ? scale : 0
}

export const formatEstimatedWeight = (weight) => {
  const value = readNumber(weight)
  if (value === null || value <= 0) return ''
  if (value < 1) return `${Math.round(value * 1000)} g`
  return `${Number(value.toFixed(3))} kg`
}

export const formatMainPrice = (product, currency, variant = null) => {
  const price = getEffectiveUnitPrice(product, variant)
  if (price === null) return ''
  return `${formatCurrency(price, currency ?? product?.currency ?? 'ARS')} por ${getSaleUnitSymbol(product)}`
}

export const formatWeightHint = (product, currency, variant = null) => {
  if (!isWeightBasedUnitPrice(product)) return ''
  const pricePerKg = readNumber(variant?.pricePerKg ?? product?.pricePerUnit ?? product?.pricePerKg)
  const estimatedWeight = variant?.estimatedUnitWeightKg ?? product?.estimatedUnitWeightKg
  const weightLabel = formatEstimatedWeight(estimatedWeight)
  if (pricePerKg === null || !weightLabel) return ''
  const pricingUnit = product?.unit?.symbol || product?.pricingUnitSymbol || 'kg'
  return `${formatCurrency(pricePerKg, currency ?? product?.currency ?? 'ARS')}/${pricingUnit} · ${weightLabel} aprox. por ${getSaleUnitSymbol(product)}`
}
