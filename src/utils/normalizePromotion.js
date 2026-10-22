import { resolveStoreAssetUrl } from './resolveStoreAssetUrl.js'

const readImageSource = (entry) =>
  typeof entry === 'string' ? entry : entry?.url ?? entry?.src ?? ''

// Amounts stay as API strings: the backend owns bundle pricing and the client must not recompute it.
const readAmount = (value) => (value == null || value === '' ? null : String(value))

const readRequirements = (promotion) => {
  const requirements = promotion.requirements ?? promotion.items ?? promotion.products ?? []
  return Array.isArray(requirements) ? requirements : []
}

const readRequirementImage = (promotion) => {
  for (const requirement of readRequirements(promotion)) {
    const image = readImageSource(requirement?.product?.imageUrls?.[0] ?? requirement?.imageUrls?.[0])
    if (image) return image
  }
  return ''
}

const formatRequirementQuantity = (value) => {
  const quantity = Number(value)
  if (!Number.isFinite(quantity) || quantity <= 0) return ''
  return String(Number(quantity.toFixed(3)))
}

const readIncludedProducts = (promotion) => readRequirements(promotion).flatMap((requirement) => {
  const name = requirement?.productName ?? requirement?.product?.name ?? requirement?.name
  if (typeof name !== 'string' || !name.trim()) return []
  const variant = requirement?.variantName ?? requirement?.variant?.name
  return [{
    name: typeof variant === 'string' && variant.trim() ? `${name.trim()} (${variant.trim()})` : name.trim(),
    quantity: formatRequirementQuantity(requirement.quantity ?? requirement.requiredQuantity) || '1'
  }]
})

// Prefers the percentage sent by the API; the amounts fallback is only for display.
const readDiscountPercent = (promotion) => {
  const sent = Number(promotion.discountPercentage ?? promotion.discountPercent ?? promotion.percentage)
  if (Number.isFinite(sent) && sent > 0) return Math.round(sent * 100) / 100

  const original = Number(promotion.bundleOriginalAmount)
  const discount = Number(promotion.bundleDiscountAmount)
  if (!Number.isFinite(original) || !Number.isFinite(discount) || original <= 0 || discount <= 0) return null
  return Math.round((discount / original) * 100)
}

export const normalizePromotion = (promotion) => {
  if (promotion?.id == null) return null

  const image = promotion.imageUrl ?? readRequirementImage(promotion)
  return {
    id: promotion.id,
    name: typeof promotion.name === 'string' && promotion.name.trim() ? promotion.name.trim() : 'Promoción',
    description: typeof promotion.description === 'string' ? promotion.description : '',
    image: image ? resolveStoreAssetUrl(image) : '',
    currency: promotion.currency ?? 'ARS',
    bundleAddable: promotion.bundleAddable === true,
    products: readIncludedProducts(promotion),
    discountPercent: readDiscountPercent(promotion),
    originalAmount: readAmount(promotion.bundleOriginalAmount),
    discountAmount: readAmount(promotion.bundleDiscountAmount),
    totalAmount: readAmount(promotion.bundleTotalAmount)
  }
}

export const normalizePromotions = (payload) => {
  const list = Array.isArray(payload) ? payload : payload?.promotions
  if (!Array.isArray(list)) return []
  return list.map(normalizePromotion).filter(Boolean)
}

const BUNDLE_ERROR_MESSAGES = {
  cart_revision_conflict: 'Tu carrito cambió. Revisalo e intentá de nuevo.',
  promotion_not_available: 'La promoción venció o dejó de estar activa.',
  promotion_bundle_not_addable: 'Elegí las variantes desde el producto para aprovechar esta promoción.',
  product_unavailable: 'El combo ya no está disponible.',
  product_quantity_limit_reached: 'El combo ya no está disponible.',
  cart_line_limit_reached: 'No se pudo agregar el combo: alcanzaste el límite de productos del carrito.',
  order_amount_limit_reached: 'No se pudo agregar el combo: superaría el monto máximo del pedido.',
  promotion_bundle_not_present: 'Ese combo ya no está en tu carrito.',
  invalid_product_quantity: 'Ese combo ya no está en tu carrito.'
}

export const getBundleErrorMessage = (error) =>
  BUNDLE_ERROR_MESSAGES[error?.code] ?? 'No se pudo actualizar la promoción. Intentá de nuevo.'
