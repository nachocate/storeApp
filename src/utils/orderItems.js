const readNonEmptyString = (...values) =>
  values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? ''

const readQuantity = (value) => {
  const quantity = Number(value)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

export const normalizeOrderItems = (items) => {
  if (!Array.isArray(items)) return []

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const product = item.product ?? item
    const variant = item.variant ?? {}
    const name = readNonEmptyString(
      item.productName,
      item.name,
      product.name,
      product.productName
    )
    const quantity = readQuantity(item.quantity)
    if (!name || quantity === null) return []

    const unit = item.unit ?? product.unit ?? {}
    const decimalScale = Number.isInteger(unit.decimalScale) && unit.decimalScale >= 0
      ? unit.decimalScale
      : Number.isInteger(item.decimalScale) && item.decimalScale >= 0
        ? item.decimalScale
        : 0

    return [{
      name,
      variantLabel: readNonEmptyString(item.variantLabel, item.variantName, variant.label, variant.name),
      quantity,
      unitSymbol: readNonEmptyString(item.unitSymbol, unit.symbol, product.unitSymbol) || 'u',
      decimalScale
    }]
  })
}

export const snapshotOrderItems = (items) => normalizeOrderItems(items)

export const readOrderItems = (order) =>
  normalizeOrderItems(order?.items ?? order?.orderItems ?? order?.products)
