<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import ProductPage from './components/ProductPage.vue'
import ScrollIndicators from './components/ScrollIndicators.vue'
import PromotionsCarousel from './components/PromotionsCarousel.vue'
import { setCatalogPrices } from './utils/formatCurrency.js'
import { normalizePromotions } from './utils/normalizePromotion.js'
import CheckoutPage from './components/CheckoutPage.vue'
import WelcomePage from './components/WelcomePage.vue'
import storeInfo from './data/store-info.json'
import { requestStoreApi } from './api/store.js'
import {
  IS_ENVIRONMENT_MISMATCH,
  IS_HOME,
  REQUESTED_PUBLIC_ORDER_ID,
  STORE_SLUG,
  buildStorePath
} from './config/store.js'
import { useVisitorCart } from './composables/useVisitorCart.js'
import { useStoreOrders } from './composables/useStoreOrders.js'
import { resolveStoreAssetUrl } from './utils/resolveStoreAssetUrl.js'
import { takeMercadoPagoReturnPublicOrderId } from './utils/mercadoPagoReturn.js'
import { consumeOrderTrackingTokenFromHash } from './utils/orderTrackingCredentials.js'
import { readQuantityRules } from './utils/quantityRules.js'
import { isValidEmail } from './utils/invoiceData.js'
import { isStoreCurrentlyOpen, normalizeWeeklyHours } from './utils/storeHours.js'
import { blendColors, getContrastColor, getReadableColor, LIGHT_TEXT_COLOR } from './utils/contrast.js'
const isHome = IS_HOME
const environmentMismatch = IS_ENVIRONMENT_MISMATCH
const orderTrackingTokenFromLink = consumeOrderTrackingTokenFromHash({
  storeSlug: STORE_SLUG,
  publicOrderId: REQUESTED_PUBLIC_ORDER_ID
})
const LOADING_PRIMARY_COLOR = '#9ca3af'
const LOADING_SECONDARY_COLOR = '#e5e7eb'
const LOADING_BACKGROUND_COLOR = '#f3f4f6'
const storeName = ref('')
const storeNotFound = ref(false)
const storeError = ref('')
const bannerSlogan = ref('')
const storePhone = ref('')
const storeEmail = ref('')
const storeAddress = ref('')
const storeTimezone = ref('')
const storeAcceptingOrders = ref(null)
const storeSupportsDelivery = ref(false)
const weeklyHours = ref([])
const hoursDialogVisible = ref(false)
const currentClock = ref(Date.now())
const branding = reactive({ primaryColor: '', secondaryColor: '', backgroundColor: '' })
let storeClockInterval = null
const settingsLoading = ref(true)
watch(storeName, (name) => {
  if (typeof document !== 'undefined') document.title = name
}, { immediate: true })
watch(storeNotFound, (notFound) => {
  if (notFound && typeof document !== 'undefined') document.title = 'Tienda no encontrada | 404'
})
watch(storeError, (error) => {
  if (error && typeof document !== 'undefined') document.title = 'Algo salió mal | VitrinApp'
})
watch(() => branding.backgroundColor, (backgroundColor) => {
  if (isHome || typeof document === 'undefined') return
  document.documentElement.style.setProperty(
    '--store-background-color',
    backgroundColor || storeInfo.branding.backgroundColor
  )
}, { immediate: true })
if (isHome && typeof document !== 'undefined') document.title = 'VitrinApp | Tiendas locales'
if (environmentMismatch && typeof document !== 'undefined') document.title = 'Tienda no encontrada | 404'
const storeLogoModules = import.meta.glob('./assets/**/*.{png,jpg,jpeg,svg,webp}', {
  query: '?url',
  import: 'default'
})
const logoUrl = ref('')
const logoFailed = ref(false)
const bannerImageUrl = ref('')
const bannerImageFailed = ref(true)
const storeSecondaryContrastColor = computed(() => getContrastColor(
  settingsLoading.value
    ? LOADING_SECONDARY_COLOR
    : branding.secondaryColor || storeInfo.branding.secondaryColor
))
const storeIsOpen = computed(() => storeAcceptingOrders.value === false
  ? false
  : isStoreCurrentlyOpen(weeklyHours.value, new Date(currentClock.value), storeTimezone.value))
const whatsappUrl = computed(() => {
  const number = storePhone.value.replace(/\D/g, '')
  return number ? `https://wa.me/${number}` : ''
})
const supportContact = computed(() => {
  if (whatsappUrl.value) {
    return { url: whatsappUrl.value, label: 'Escribinos por WhatsApp', icon: 'pi pi-whatsapp', external: true }
  }
  if (storeEmail.value) {
    return { url: `mailto:${storeEmail.value}`, label: 'Escribinos por email', icon: 'pi pi-envelope', external: false }
  }
  return null
})
const mapsUrl = computed(() => storeAddress.value
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress.value)}`
  : '')
const ordersCount = computed(() => orders.value.length)
const formatHoursTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const readStoreContact = (settings) => {
  const contact = settings.contact ?? settings.contactInfo ?? settings.businessInfo ?? {}
  const phone = settings.whatsappNumber ?? settings.phoneNumber ?? settings.phone ??
    contact.whatsappNumber ?? contact.phoneNumber ?? contact.phone ?? ''
  const addressValue = settings.address ?? settings.addressLine ??
    (typeof settings.location === 'string' ? settings.location : settings.location?.address) ??
    contact.address ?? contact.location?.address ?? ''
  const address = typeof addressValue === 'string'
    ? addressValue
    : addressValue?.formattedAddress ?? addressValue?.fullAddress ?? ''
  const schedule = settings.openingHours ?? settings.businessHours ?? settings.hours ??
    settings.schedule?.weeklyHours ?? settings.schedule?.weekly ?? settings.schedule
  const fulfillmentOptions = settings.fulfillmentOptions ?? settings.fulfillment?.options ?? []
  const listedDelivery = Array.isArray(fulfillmentOptions) && fulfillmentOptions.some((option) =>
    (option.type ?? option.fulfillmentType) === 'DELIVERY' && option.enabled !== false
  )
  const deliveryValue = settings.deliveryEnabled ?? settings.hasDelivery ?? settings.deliveryAvailable ??
    settings.delivery?.enabled ?? settings.fulfillment?.deliveryEnabled

  storePhone.value = phone == null ? '' : String(phone).trim()
  const emailValue = settings.email ?? settings.contactEmail ?? settings.supportEmail ??
    contact.email ?? contact.contactEmail ?? ''
  storeEmail.value = typeof emailValue === 'string' && isValidEmail(emailValue) ? emailValue.trim() : ''
  storeAddress.value = address.trim()
  storeTimezone.value = settings.timezone ?? settings.timeZone ?? ''
  storeAcceptingOrders.value = typeof settings.isAcceptingOrders === 'boolean'
    ? settings.isAcceptingOrders
    : null
  storeSupportsDelivery.value = deliveryValue === true || listedDelivery
  weeklyHours.value = normalizeWeeklyHours(schedule)
}

const loadDeliveryAvailability = async () => {
  if (!cartToken.value) return
  try {
    const payload = await requestStoreApi('/carts/current/checkout-options', {
      cartToken: cartToken.value
    })
    const options = payload?.fulfillmentOptions ?? payload?.data?.fulfillmentOptions
    if (Array.isArray(options)) {
      storeSupportsDelivery.value = options.some((option) =>
        option.type === 'DELIVERY' && option.enabled === true
      )
    }
  } catch {
    // Keep the availability reported by store settings if the cart options are temporarily unavailable.
  }
}
const storeThemeStyle = computed(() => {
  const primaryColor = settingsLoading.value
    ? LOADING_PRIMARY_COLOR
    : branding.primaryColor || storeInfo.branding.primaryColor
  const secondaryColor = settingsLoading.value
    ? LOADING_SECONDARY_COLOR
    : branding.secondaryColor || storeInfo.branding.secondaryColor
  const hoverColor = `color-mix(in srgb, ${primaryColor} 86%, #000)`
  const activeColor = `color-mix(in srgb, ${primaryColor} 76%, #000)`
  const secondaryHoverColor = `color-mix(in srgb, ${secondaryColor} 86%, #000)`
  const secondaryActiveColor = `color-mix(in srgb, ${secondaryColor} 76%, #000)`
  const contrastColor = getContrastColor(primaryColor)
  const secondaryContrastColor = getContrastColor(secondaryColor)
  const backgroundColor = settingsLoading.value
    ? LOADING_BACKGROUND_COLOR
    : branding.backgroundColor || storeInfo.branding.backgroundColor
  const toolsSurfaceColor = blendColors('#ffffff', backgroundColor, 0.8)
  const bannerBackgroundColor = blendColors(primaryColor, backgroundColor, 0.25)
  const bannerTextColor = bannerImageUrl.value ? contrastColor : getContrastColor(bannerBackgroundColor)

  return {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
    '--secondary-contrast-color': secondaryContrastColor,
    '--primary-text-color': getReadableColor(primaryColor, ['#ffffff', toolsSurfaceColor]),
    '--primary-on-background-color': getReadableColor(primaryColor, [backgroundColor]),
    '--primary-on-secondary-color': getReadableColor(primaryColor, [secondaryColor]),
    '--background-color': backgroundColor,
    '--banner-image': bannerImageUrl.value ? `url(${bannerImageUrl.value})` : 'none',
    '--banner-overlay': `color-mix(in srgb, ${primaryColor} 25%, transparent)`,
    '--banner-text-color': bannerTextColor,
    '--banner-text-shadow': bannerTextColor === LIGHT_TEXT_COLOR
      ? '0 2px 8px rgb(0 0 0 / 95%), 0 0 20px rgb(0 0 0 / 70%)'
      : '0 2px 8px rgb(255 255 255 / 95%), 0 0 20px rgb(255 255 255 / 75%)',
    '--p-primary-color': primaryColor,
    '--p-primary-hover-color': hoverColor,
    '--p-primary-active-color': activeColor,
    '--p-primary-contrast-color': contrastColor,
    '--p-focus-ring-color': `color-mix(in srgb, ${primaryColor} 28%, transparent)`,
    '--p-button-primary-background': primaryColor,
    '--p-button-primary-hover-background': hoverColor,
    '--p-button-primary-active-background': activeColor,
    '--p-button-primary-border-color': primaryColor,
    '--p-button-primary-hover-border-color': hoverColor,
    '--p-button-primary-active-border-color': activeColor,
    '--p-button-primary-color': contrastColor,
    '--p-button-primary-hover-color': contrastColor,
    '--p-button-primary-active-color': contrastColor,
    '--p-button-primary-focus-ring-color': primaryColor,
    '--p-button-secondary-background': secondaryColor,
    '--p-button-secondary-hover-background': secondaryHoverColor,
    '--p-button-secondary-active-background': secondaryActiveColor,
    '--p-button-secondary-border-color': secondaryColor,
    '--p-button-secondary-hover-border-color': secondaryHoverColor,
    '--p-button-secondary-active-border-color': secondaryActiveColor,
    '--p-button-secondary-color': secondaryContrastColor,
    '--p-button-secondary-hover-color': secondaryContrastColor,
    '--p-button-secondary-active-color': secondaryContrastColor,
    '--p-button-secondary-focus-ring-color': secondaryColor,
    '--p-badge-primary-background': primaryColor,
    '--p-badge-primary-color': contrastColor,
    '--p-inputtext-focus-border-color': primaryColor,
    '--p-inputtext-focus-ring-color': primaryColor,
    '--p-textarea-focus-border-color': primaryColor,
    '--p-textarea-focus-ring-color': primaryColor,
    '--p-tag-primary-background': primaryColor,
    '--p-tag-primary-color': contrastColor,
    '--p-message-info-background': secondaryColor,
    '--p-message-info-border-color': secondaryColor,
    '--p-message-info-color': secondaryContrastColor,
    '--p-message-text-color': secondaryContrastColor,
    '--p-togglebutton-checked-background': primaryColor,
    '--p-togglebutton-checked-hover-background': hoverColor,
    '--p-togglebutton-checked-border-color': primaryColor,
    '--p-togglebutton-checked-color': contrastColor,
    '--p-radiobutton-checked-background': primaryColor,
    '--p-radiobutton-checked-hover-background': hoverColor,
    '--p-radiobutton-checked-border-color': primaryColor,
    '--p-radiobutton-checked-hover-border-color': hoverColor
  }
})

const loadStoreLogo = async (configuredLogo) => {
  logoUrl.value = ''
  logoFailed.value = false
  if (!configuredLogo) return

  const logoLoader = storeLogoModules[configuredLogo]
  logoUrl.value = logoLoader ? await logoLoader() : resolveStoreAssetUrl(configuredLogo)
}
const loadBannerImage = (configuredImage) => {
  bannerImageUrl.value = ''
  bannerImageFailed.value = true
  if (!configuredImage) return

  const imageUrl = resolveStoreAssetUrl(configuredImage)
  if (!imageUrl) return

  const image = new Image()
  image.onload = () => {
    bannerImageUrl.value = imageUrl
    bannerImageFailed.value = false
  }
  image.onerror = () => {
    bannerImageUrl.value = ''
    bannerImageFailed.value = true
  }
  image.src = imageUrl
}
const products = reactive([])
const categoryData = ref([])
const promotions = ref([])
watch(
  () => [
    ...products.map((product) => product.pricePerType),
    ...promotions.value.flatMap((promotion) =>
      [promotion.originalAmount, promotion.discountAmount, promotion.totalAmount])
  ],
  setCatalogPrices,
  { immediate: true }
)
const productsLoading = ref(true)
const productsLoadingMore = ref(false)
const productsError = ref('')
const productsMoreError = ref('')
const productsOffset = ref(0)
const productsHasMore = ref(true)
const loadMoreSentinel = ref(null)
const PRODUCTS_PAGE_SIZE = 20
let productsObserver = null

const {
  addPromotionBundle,
  addToCart: addCartItem,
  busyPromotionId,
  cart,
  cartError,
  cartInitializing,
  cartItems,
  cartLoading,
  cartRevision,
  cartToken,
  cartTotals,
  clearCompletedCart,
  discountAmount,
  flushCartRequests,
  formatCartAmount,
  formatCartQuantity,
  formatQuantityLabel,
  getCartQuantity,
  getProductLimit,
  getProductQuantity,
  hasSavedCartItems,
  initializeCart,
  isProductBusy,
  isProductLimitReached,
  isUnavailable,
  productQty,
  refreshCurrentCart,
  removeItem: removeCartItem,
  restoreCart,
  subtotal,
  totalAmount,
  totalItems,
  updateCart,
  updateProductQuantity: updateCartProductQuantity
} = useVisitorCart({ products })
const addToCart = (product, variantId = null) => {
  if (storeIsOpen.value === false) return
  addCartItem(product, variantId)
}
const updateProductQty = (product, delta, variantId = null) => {
  if (storeIsOpen.value === false) return
  updateCartProductQuantity(product, delta, variantId)
}
const getCardVariantId = (product) => {
  if (product.productType !== 'VARIANT') return null

  const availableVariants = product.variantConfiguration?.variants?.filter((variant) => variant.available) ?? []
  return availableVariants.length === 1 ? availableVariants[0].id : null
}

// The promotions endpoint is optional: failures just hide the block.
const loadPromotions = async () => {
  try {
    promotions.value = normalizePromotions(await requestStoreApi('/promotions'))
  } catch {
    promotions.value = []
  }
}

const promotionError = ref('')
const addPromotion = async (promotion) => {
  if (storeIsOpen.value === false || !promotion.bundleAddable) return
  promotionError.value = ''
  const result = await addPromotionBundle(promotion.id)
  if (result.ok) return
  promotionError.value = result.message
  if (['promotion_not_available', 'promotion_bundle_not_addable'].includes(result.code)) {
    await loadPromotions()
  }
}
const {
  addOrder: saveStoreOrder,
  cancelOrder: cancelStoreOrder,
  changePaymentMethod: changeStorePaymentMethod,
  loadOrderByPublicId,
  orders,
  orderErrors,
  removeOrder: removeStoreOrder,
  syncOrder,
  submitTransferProof,
  transferErrors,
  transferSuccess,
  uploadingProofs
} = useStoreOrders()
const trackedOrderId = ref(null)
const trackingFromUrl = ref(false)

watch(loadMoreSentinel, (sentinel) => {
  if (sentinel) productsObserver?.observe(sentinel)
}, { flush: 'post' })

const normalizeApiProduct = (product) => {
  const { decimalScale, step, minQuantity, unitSymbol } = readQuantityRules(product)
  const productType = product.productType ?? 'SIMPLE'
  const variantConfiguration = product.variantConfiguration ?? null
  const isAvailable = productType === 'VARIANT'
    ? Boolean(variantConfiguration?.variants?.some((variant) => variant.available))
    : product.available
  const maxQuantityPerOrder = product.maxQuantityPerOrder == null
    ? null
    : Number(product.maxQuantityPerOrder)
  const images = (Array.isArray(product.imageUrls) ? product.imageUrls : [])
    .map((entry) => typeof entry === 'string' ? entry : entry?.url ?? entry?.src ?? '')
    .filter(Boolean)
    .map((image) => resolveStoreAssetUrl(image))
  const category = product.category?.name ?? 'Otros'

  return {
    id: product.id,
    name: product.name,
    productType,
    quantityType: decimalScale > 0 ? 'weight' : 'unit',
    description: product.description ?? '',
    image: images[0] ?? '',
    images,
    imageFallback: category.toLocaleLowerCase('es').includes('pasteler')
      ? 'pastry'
      : category.toLocaleLowerCase('es').includes('accesor')
        ? 'accessory'
        : 'coffee',
    category,
    currency: product.currency ?? 'ARS',
    pricePerType: Number(product.pricePerUnit),
    maxQuantityPerOrder,
    isSoldOut: !isAvailable,
    isVisible: true,
    variantConfiguration,
    step,
    minQuantity,
    decimalScale,
    unitSymbol,
    quantity: isAvailable
      ? Math.min(minQuantity, maxQuantityPerOrder ?? minQuantity)
      : 0
  }
}

const loadProducts = async ({ append = false } = {}) => {
  if (append) {
    if (productsLoadingMore.value || !productsHasMore.value) return
    productsLoadingMore.value = true
    productsMoreError.value = ''
  } else {
    productsLoading.value = true
    settingsLoading.value = true
    storeNotFound.value = false
    storeError.value = ''
    productsError.value = ''
    productsMoreError.value = ''
  }

  try {
    const pageOffset = append ? productsOffset.value : 0
    const pageLimit = !append && hasSavedCartItems() ? 100 : PRODUCTS_PAGE_SIZE
    const [settingsResult, productsResult, categoriesResult] = await Promise.allSettled([
      append ? Promise.resolve(null) : requestStoreApi('/settings'),
      requestStoreApi(`/products?limit=${pageLimit}&offset=${pageOffset}`),
      append ? Promise.resolve(null) : requestStoreApi('/categories'),
      append ? Promise.resolve(null) : loadPromotions()
    ])

    if (!append) {
      const failures = [settingsResult, productsResult, categoriesResult]
        .filter((result) => result.status === 'rejected')
      const notFound = failures.find((error) => error?.status === 404)

      if (notFound) {
        return
      }

      if (failures.length > 0) {
        storeError.value = failures.some((error) => error?.status === 500)
          ? 'Algo salió mal. Inténtalo de nuevo más tarde.'
          : 'No pudimos cargar la tienda. Inténtalo de nuevo más tarde.'
        return
      }

      storeNotFound.value = false
      storeError.value = ''
    }

    if (!append) {
      const settings = settingsResult.value
      const theme = settings.theme ?? {}
      storeName.value = settings.name ?? storeInfo.ecommerceName
      bannerSlogan.value = settings.description ?? storeInfo.bannerSlogan
      readStoreContact(settings)
      branding.primaryColor = theme.primaryColor ?? storeInfo.branding.primaryColor
      branding.secondaryColor = theme.secondaryColor ?? storeInfo.branding.secondaryColor
      branding.backgroundColor = theme.backgroundColor ?? storeInfo.branding.backgroundColor
      await loadStoreLogo(theme.logoImageUrl ?? storeInfo.logoUrl)
      loadBannerImage(theme.bannerImageUrl ?? storeInfo.bannerImg)
    }

    if (productsResult.status === 'rejected') throw productsResult.reason
    const payload = productsResult.value
    if (!Array.isArray(payload.products)) throw new Error('Invalid products payload')

    const loadedProducts = payload.products.map(normalizeApiProduct)
    if (append) {
      const knownProductIds = new Set(products.map((product) => product.id))
      products.push(...loadedProducts.filter((product) => !knownProductIds.has(product.id)))
    } else {
      products.splice(0, products.length, ...loadedProducts)
      const categoryPayload = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
      categoryData.value = Array.isArray(categoryPayload)
        ? categoryPayload
        : Array.isArray(categoryPayload?.categories)
          ? categoryPayload.categories
          : []
      restoreCart()
    }

    productsOffset.value = Number(payload.offset ?? pageOffset) + loadedProducts.length
    const totalProducts = Number(payload.total)
    productsHasMore.value = loadedProducts.length > 0 && (Number.isFinite(totalProducts)
      ? productsOffset.value < totalProducts
      : loadedProducts.length >= pageLimit)
  } catch {
    if (append) {
      productsMoreError.value = 'No se pudieron cargar más productos.'
    } else {
      productsError.value = 'No se pudieron cargar los productos. Comprueba la conexión y vuelve a intentarlo.'
    }
  } finally {
    if (append) {
      productsLoadingMore.value = false
    } else {
      productsLoading.value = false
      settingsLoading.value = false
    }
  }
}

const categories = computed(() => {
  const names = categoryData.value.length
    ? categoryData.value.map((category) => category.name).filter(Boolean)
    : products.filter((product) => product.isVisible).map((product) => product.category)
  return [...new Set(names)]
})

const search = ref('')
const selectedCategory = ref('')
const cartOpen = ref(false)
const checkoutOpen = ref(false)
const pendingRemoval = ref(null)
const removeDialogVisible = ref(false)
watch(storeIsOpen, (isOpen) => {
  if (isOpen === false) cartOpen.value = false
})
const sortOptions = [
  { value: 'name-asc', label: 'Nombre A-Z', icon: 'pi pi-sort-alpha-up' },
  { value: 'name-desc', label: 'Nombre Z-A', icon: 'pi pi-sort-alpha-down' },
  { value: 'price-asc', label: 'Precio menor a mayor', icon: 'pi pi-sort-amount-up' },
  { value: 'price-desc', label: 'Precio mayor a menor', icon: 'pi pi-sort-amount-down' }
]
const sortOption = ref(sortOptions.find((option) => option.value === 'name-asc'))
const sortSelectPt = computed(() => {
  const secondaryColor = branding.secondaryColor || storeInfo.branding.secondaryColor
  const contrastColor = storeSecondaryContrastColor.value

  return {
    option: ({ context }) => context.selected
      ? {
          style: {
            backgroundColor: secondaryColor,
            color: contrastColor,
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

const retryStore = async () => {
  await loadProducts()
  if (!storeNotFound.value && !storeError.value) await initializeCart()
}

onMounted(async () => {
  if (isHome || environmentMismatch) return
  storeClockInterval = window.setInterval(() => {
    currentClock.value = Date.now()
  }, 60_000)
  const requestedOrderPromise = REQUESTED_PUBLIC_ORDER_ID
    ? loadOrderByPublicId(REQUESTED_PUBLIC_ORDER_ID, orderTrackingTokenFromLink)
    : null

  if ('IntersectionObserver' in window) {
    productsObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !productsMoreError.value) {
        void loadProducts({ append: true })
      }
    }, { rootMargin: '400px 0px' })
    if (loadMoreSentinel.value) productsObserver.observe(loadMoreSentinel.value)
  }

  await loadProducts()
  if (!storeNotFound.value && !storeError.value && !REQUESTED_PUBLIC_ORDER_ID) {
    await initializeCart()
    await ensureSelectedProduct()
    await loadDeliveryAvailability()
  }
  if (!storeNotFound.value && REQUESTED_PUBLIC_ORDER_ID) {
    const result = await requestedOrderPromise
    const requestedOrder = orders.value.find((order) =>
      order.publicOrderId === REQUESTED_PUBLIC_ORDER_ID)
    openOrderTracking(result === 'ok' ? String(requestedOrder?.orderId ?? '') : REQUESTED_PUBLIC_ORDER_ID)
  } else if (!storeNotFound.value && !storeError.value) {
    const mercadoPagoReturnPublicOrderId = takeMercadoPagoReturnPublicOrderId(STORE_SLUG)
    if (mercadoPagoReturnPublicOrderId) {
      const result = await loadOrderByPublicId(
        mercadoPagoReturnPublicOrderId,
        '',
        { persistLocally: true }
      )
      const returnedOrder = orders.value.find((order) =>
        order.publicOrderId === mercadoPagoReturnPublicOrderId)
      openOrderTracking(result === 'ok' && returnedOrder
        ? String(returnedOrder.orderId)
        : returnedOrder?.orderId ?? mercadoPagoReturnPublicOrderId)
    }
  }
})

onBeforeUnmount(() => {
  productsObserver?.disconnect()
  if (storeClockInterval) window.clearInterval(storeClockInterval)
})

const loadNextProducts = () => loadProducts({ append: true })

const removeFromCart = (productId, variantId = null) => {
  removeCartItem(productId, variantId)
  pendingRemoval.value = null
  removeDialogVisible.value = false
}

const promptRemoveFromCart = (productId, variantId = null, variantLabel = '') => {
  const product = products.find((entry) => entry.id === productId)
  if (!product) return

  const variant = product.variantConfiguration?.variants?.find((entry) => entry.id === variantId)
  pendingRemoval.value = {
    ...product,
    variantId,
    variantLabel: variantLabel || variant?.label || ''
  }
  removeDialogVisible.value = true
}

const cancelRemoval = () => {
  pendingRemoval.value = null
  removeDialogVisible.value = false
}

const beginCheckout = async () => {
  if (storeIsOpen.value === false || cartItems.value.length === 0 || cartLoading.value) return

  await flushCartRequests()
  if (cartError.value) return
  if (cartRevision.value === null) {
    try {
      await refreshCurrentCart()
    } catch (error) {
      cartError.value = error.message || 'No se pudo verificar el carrito.'
      return
    }
  }
  cartOpen.value = false
  checkoutOpen.value = true
}

const returnToStore = () => {
  const storePath = buildStorePath(STORE_SLUG)
  if (window.location.pathname !== storePath || REQUESTED_PUBLIC_ORDER_ID) {
    window.location.assign(storePath)
    return
  }

  checkoutOpen.value = false
  trackedOrderId.value = null
  trackingFromUrl.value = false
}

const openOrderTracking = (requestedOrderId = '') => {
  const target = requestedOrderId
    ? orders.value.find((order) => String(order.orderId) === String(requestedOrderId))
    : orders.value[0]
  cartOpen.value = false
  trackedOrderId.value = target?.orderId ?? null
  trackingFromUrl.value = Boolean(requestedOrderId)
  checkoutOpen.value = true
}

const PRODUCT_QUERY_PARAM = 'product'
const readProductIdFromUrl = () => new URLSearchParams(window.location.search).get(PRODUCT_QUERY_PARAM) ?? ''
const selectedProductId = ref(readProductIdFromUrl())
const selectedVariantId = ref(null)
watch(selectedProductId, () => {
  selectedVariantId.value = null
})
watch([selectedProductId, checkoutOpen], ([productId, isCheckoutOpen]) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle(
      'product-page-open',
      Boolean(productId) && !isCheckoutOpen
    )
  }
}, { immediate: true })
const productPageLoading = ref(false)
const productPageError = ref('')
const selectedProduct = computed(() =>
  products.find((product) => String(product.id) === selectedProductId.value) ?? null)

const ensureSelectedProduct = async () => {
  const productId = selectedProductId.value
  if (!productId || selectedProduct.value) return

  productPageLoading.value = true
  productPageError.value = ''
  try {
    const payload = await requestStoreApi(`/products/${encodeURIComponent(productId)}`)
    if (selectedProductId.value !== productId || selectedProduct.value) return
    if (payload?.id == null) throw new Error('Invalid product payload')
    products.push(normalizeApiProduct(payload))
  } catch (error) {
    if (error?.status !== 404) {
      productPageError.value = 'No pudimos cargar el producto. Comprueba la conexión y vuelve a intentarlo.'
    }
  } finally {
    productPageLoading.value = false
  }
}

const openProductPage = (product) => {
  const url = new URL(window.location.href)
  url.searchParams.set(PRODUCT_QUERY_PARAM, String(product.id))
  window.history.pushState({ productPage: true }, '', url)
  productPageError.value = ''
  selectedVariantId.value = null
  selectedProductId.value = String(product.id)
}

const closeProductPage = () => {
  if (window.history.state?.productPage) {
    window.history.back()
    return
  }
  const url = new URL(window.location.href)
  url.searchParams.delete(PRODUCT_QUERY_PARAM)
  window.history.replaceState(null, '', url)
  selectedProductId.value = ''
  productPageError.value = ''
}

const syncProductPageWithUrl = () => {
  selectedProductId.value = readProductIdFromUrl()
  productPageError.value = ''
  void ensureSelectedProduct()
}

onMounted(() => window.addEventListener('popstate', syncProductPageWithUrl))
onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncProductPageWithUrl)
  document.documentElement.classList.remove('product-page-open')
})
</script>

<template>
  <head>
    <title>{{ isHome ? 'VitrinApp | Tiendas locales' : storeNotFound || environmentMismatch ? 'Tienda no encontrada | 404' : storeError ? 'Algo salió mal | VitrinApp' : storeName || 'Cargando tienda' }}</title>
    <meta name="description" :content="isHome ? 'Descubre tiendas independientes en VitrinApp.' : `Bienvenido a ${storeName}, tu tienda en línea de confianza.`">
    <meta name="keywords" content="ecommerce, tienda online, compras, productos frescos, frutas, verduras">
    <meta name="author" :content="storeName">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <main id="app" :style="storeThemeStyle" :class="{ 'home-shell': isHome }">
      <WelcomePage v-if="isHome" />
      <section v-else-if="storeNotFound || environmentMismatch" class="store-status">
        <Message severity="error" :closable="false" class="store-status-message">
          <div>
            <strong>Error 404: No encontramos esta tienda</strong>
            <p>No existe una tienda disponible con el identificador <strong>{{ STORE_SLUG }}</strong>.</p>
            <Button as="a" href="/" label="Volver al inicio" severity="secondary" />
          </div>
        </Message>
      </section>
      <section v-else-if="storeError && !REQUESTED_PUBLIC_ORDER_ID" class="store-status">
        <Message severity="error" :closable="false" class="store-status-message">
          <div>
            <strong>Error del servidor</strong>
            <p>Algo salió mal. Inténtalo de nuevo más tarde.</p>
            <Button label="Reintentar" icon="pi pi-refresh" @click="retryStore" />
          </div>
        </Message>
      </section>
      <CheckoutPage
        v-else-if="checkoutOpen"
        :items="cartItems"
        :cart-token="cartToken"
        :revision="cartRevision"
        :subtotal="subtotal"
        :discount-amount="discountAmount"
        :total-amount="totalAmount"
        :currency="cartTotals.currency"
        :store-name="storeName"
        :support-contact="supportContact"
        :save-order="saveStoreOrder"
        :refresh-cart="refreshCurrentCart"
        :orders="orders"
        :tracked-order-id="trackedOrderId"
        :requested-public-order-id="trackingFromUrl ? REQUESTED_PUBLIC_ORDER_ID : ''"
        :load-order-by-public-id="loadOrderByPublicId"
        :cancel-order="cancelStoreOrder"
        :change-payment-method="changeStorePaymentMethod"
        :remove-order="removeStoreOrder"
        :sync-order="syncOrder"
        :order-errors="orderErrors"
        :transfer-errors="transferErrors"
        :transfer-success="transferSuccess"
        :uploading-proofs="uploadingProofs"
        :submit-transfer-proof="submitTransferProof"
        @back="returnToStore"
        @complete="clearCompletedCart"
      />
      <template v-else>
      <section id="banner" :class="{ 'store-loading-state': settingsLoading }">
        <template v-if="settingsLoading || storeNotFound">
          <div class="identity identity-skeleton" aria-hidden="true">
            <Skeleton shape="circle" size="6.25rem" />
            <Skeleton width="15rem" height="1.6rem" />
          </div>
          <Skeleton width="min(24rem, 75vw)" height="1rem" class="banner-skeleton-slogan" />
        </template>
        <template v-else>
          <div v-if="bannerImageFailed" class="banner-fallback-icon" aria-hidden="true">
            <i class="pi pi-shop"></i>
          </div>
          <div class="identity">
            <img v-if="logoUrl && !logoFailed" :src="logoUrl" :alt="storeName + ' Logo'" class="logo" @error="logoFailed = true" />
            <div v-else class="logo logo-fallback" role="img" :aria-label="`Logo de ${storeName}`">
              <i class="pi pi-shop" aria-hidden="true"></i>
            </div>
            <h1>{{ storeName }}</h1>
          </div>
          <h3 class="store-slogan">{{ bannerSlogan }}</h3>
          <span v-if="storeSupportsDelivery" class="delivery-badge">
            <i class="pi pi-truck" aria-hidden="true"></i>
            Delivery
          </span>
          <div class="store-banner-links">
            <a
              v-if="mapsUrl"
              class="banner-action"
              :href="mapsUrl"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver dirección en Maps"
              title="Ubicación"
            >
              <i class="pi pi-map-marker" aria-hidden="true"></i>
              <span>Cómo llegar</span>
            </a>
            <Button
              type="button"
              class="banner-action"
              text
              icon="pi pi-clock"
              label="Horarios"
              aria-label="Ver horarios de atención de la tienda virtual"
              @click="hoursDialogVisible = true"
            />
          </div>
          <p v-if="storeIsOpen === false" class="store-closed-message" role="status">
            La tienda se encuentra cerrada en este momento.
          </p>
          <Button
            v-if="storeIsOpen === false && ordersCount > 0"
            type="button"
            class="closed-orders-button"
            icon="pi pi-receipt"
            :label="`Mis pedidos (${ordersCount})`"
            @click="openOrderTracking()"
          />
        </template>
      </section>

      <Dialog
        v-model:visible="hoursDialogVisible"
        modal
        header="Horarios de la tienda virtual"
        :style="{ width: 'min(92vw, 28rem)' }"
      >
        <div class="weekly-hours-list">
          <div v-if="!weeklyHours.length" class="weekly-hours-empty">
            La tienda todavía no publicó sus horarios.
          </div>
          <div v-for="day in weeklyHours" :key="day.dayIndex" class="weekly-hours-row">
            <strong>{{ day.label }}</strong>
            <span v-if="day.closed">Cerrado</span>
            <span v-else>{{ day.ranges.map((range) => `${formatHoursTime(range.start)} a ${formatHoursTime(range.end)}`).join(' / ') }}</span>
          </div>
        </div>
      </Dialog>
      
      <section id="tools">
        <div class="toolbar">
          <InputText class="toolbar-search" v-model="search" type="search" placeholder="Buscar productos..." aria-label="Buscar productos" />
          <div class="toolbar-selectors">
            <label class="sort-select">
              <span>Ordenar</span>
              <Select v-model="sortOption" :options="sortOptions" option-label="label" aria-label="Ordenar productos" :pt="sortSelectPt">
                <template #value="{ value, placeholder }">
                  <span v-if="value" class="sort-value"><i :class="value.icon" aria-hidden="true"></i>{{ value.label }}</span>
                  <span v-else>{{ placeholder }}</span>
                </template>
                <template #option="{ option }">
                  <span class="sort-value"><i :class="option.icon" aria-hidden="true"></i>{{ option.label }}</span>
                </template>
              </Select>
            </label>
          </div>
        </div>
        <div v-if="categories.length" class="category-filter">
          <span id="category-filter-label" class="category-filter-label">Categorías:</span>
          <button
            v-if="categoryScroll.canScrollBack"
            type="button"
            class="category-arrow category-arrow-back"
            aria-label="Ver categorías anteriores"
            @click="scrollCategories(-1)"
          >
            <i class="pi pi-chevron-left" aria-hidden="true"></i>
          </button>
          <div
            ref="categoryPillsEl"
            class="category-pills"
            data-hide-scroll-indicator
            role="group"
            aria-labelledby="category-filter-label"
            @scroll.passive="updateCategoryScroll"
          >
            <button
              v-for="category in ['', ...categories]"
              :key="category || 'all'"
              type="button"
              class="category-pill"
              :class="{ selected: selectedCategory === category }"
              :aria-pressed="selectedCategory === category"
              :disabled="productsLoading || storeNotFound"
              @click="toggleCategory(category)"
            >
              {{ category || 'Todas' }}
            </button>
          </div>
          <button
            v-if="categoryScroll.canScrollForward"
            type="button"
            class="category-arrow category-arrow-forward"
            aria-label="Ver más categorías"
            @click="scrollCategories(1)"
          >
            <i class="pi pi-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      </section>
  
      <section id="products" class="products-grid">
        <div v-if="productsLoading || storeNotFound" class="product-skeleton-grid" role="status" aria-label="Cargando productos">
          <Card v-for="placeholder in 8" :key="placeholder" class="skeleton-product-card" aria-hidden="true">
            <template #header><Skeleton class="skeleton-product-image" /></template>
            <template #content>
              <div class="skeleton-product-body">
                <div class="skeleton-meta-row">
                  <Skeleton width="5rem" height="1.5rem" />
                  <Skeleton width="4rem" height="1rem" />
                </div>
                <Skeleton width="75%" height="1.4rem" />
                <div class="skeleton-description">
                  <Skeleton width="100%" height="0.8rem" />
                  <Skeleton width="68%" height="0.8rem" />
                </div>
                <Skeleton width="100%" height="2.75rem" />
                <div class="skeleton-footer">
                  <Skeleton width="5rem" height="1.8rem" />
                  <Skeleton width="7rem" height="2.8rem" />
                </div>
              </div>
            </template>
          </Card>
        </div>
        <div v-else-if="productsError" class="empty-state">
          <Message severity="error" :closable="false">{{ productsError }}</Message>
          <Button label="Reintentar" icon="pi pi-refresh" @click="loadProducts" />
        </div>
        <Message v-if="promotionError && visiblePromotions.length" severity="error" class="promotions-section" @close="promotionError = ''">
          {{ promotionError }}
        </Message>
        <PromotionsCarousel
          v-if="visiblePromotions.length && !productsError"
          class="promotions-section"
          :promotions="visiblePromotions"
          :busy-promotion-id="busyPromotionId"
          :locked="cartLoading"
          :store-closed="storeIsOpen === false"
          @add-bundle="addPromotion"
        />
        <h2
          v-if="visiblePromotions.length && !productsError && !productsLoading && filteredProducts.length"
          class="products-title"
        >
          Productos
        </h2>
        <Message
          v-if="!productsLoading && !storeNotFound && !productsError && filteredProducts.length === 0"
          severity="info"
          :closable="false"
          class="empty-state"
        >
          No se encontraron productos.
        </Message>
        <ProductCard
          v-for="product in sortedProducts"
          :key="product.id"
          :product="product"
          :quantity-label="formatQuantityLabel(product, getCardVariantId(product))"
          :store-closed="storeIsOpen === false"
          :busy="isProductBusy(product.id, getCardVariantId(product))"
          :locked="cartInitializing || busyPromotionId !== null"
          :in-cart="getCartQuantity(product.id, getCardVariantId(product)) > 0"
          :decrease-removes-item="getCartQuantity(product.id, getCardVariantId(product)) > 0 && getCartQuantity(product.id, getCardVariantId(product)) <= product.minQuantity"
          :unavailable="isUnavailable(product, getCardVariantId(product))"
          :decrease-disabled="getProductQuantity(product, getCardVariantId(product)) <= product.minQuantity && !getCartQuantity(product.id, getCardVariantId(product))"
          :increase-disabled="isProductLimitReached(product, getCardVariantId(product)) || cartInitializing || busyPromotionId !== null"
          @change-quantity="updateProductQty(product, $event, getCardVariantId(product))"
          @add-to-cart="addToCart(product, $event)"
          @remove-from-cart="promptRemoveFromCart(product.id, $event)"
          @open="openProductPage(product)"
        />
        <div v-if="productsHasMore && !storeNotFound && !settingsLoading" class="load-more-region">
          <Message v-if="productsMoreError" severity="error" :closable="false">{{ productsMoreError }}</Message>
          <Button v-else label="Cargar más productos" icon="pi pi-chevron-down" :loading="productsLoadingMore" @click="loadNextProducts" />
          <span ref="loadMoreSentinel" class="load-more-sentinel" aria-hidden="true"></span>
        </div>
      </section>

      <ProductPage
        v-if="selectedProductId"
        :product="selectedProduct"
        :loading="productPageLoading || productsLoading"
        :error="productPageError"
        :quantity-label="selectedProduct ? formatQuantityLabel(selectedProduct, selectedVariantId) : ''"
        :store-closed="storeIsOpen === false"
        :busy="selectedProduct ? isProductBusy(selectedProduct.id, selectedVariantId) : false"
        :locked="cartInitializing || busyPromotionId !== null"
        :in-cart="selectedProduct ? getCartQuantity(selectedProduct.id, selectedVariantId) > 0 : false"
        :decrease-removes-item="selectedProduct ? getCartQuantity(selectedProduct.id, selectedVariantId) > 0 && getCartQuantity(selectedProduct.id, selectedVariantId) <= selectedProduct.minQuantity : false"
        :unavailable="selectedProduct ? isUnavailable(selectedProduct, selectedVariantId) : false"
        :decrease-disabled="selectedProduct ? getProductQuantity(selectedProduct, selectedVariantId) <= selectedProduct.minQuantity && !getCartQuantity(selectedProduct.id, selectedVariantId) : false"
        :increase-disabled="selectedProduct ? isProductLimitReached(selectedProduct, selectedVariantId) || cartInitializing || busyPromotionId !== null : false"
        @back="closeProductPage"
        @retry="ensureSelectedProduct"
        @variant-change="selectedVariantId = $event?.id ?? null"
        @change-quantity="updateProductQty(selectedProduct, $event.delta, $event.variantId)"
        @add-to-cart="addToCart(selectedProduct, $event)"
        @remove-from-cart="promptRemoveFromCart(selectedProduct.id, $event)"
      />

      <Dialog
        v-model:visible="removeDialogVisible"
        modal
        header="Eliminar producto"
        :style="{ width: 'min(92vw, 28rem)' }"
        @hide="cancelRemoval"
      >
        <p v-if="pendingRemoval">
          ¿Deseas quitar <strong>{{ pendingRemoval.name }}<template v-if="pendingRemoval.variantLabel"> — {{ pendingRemoval.variantLabel }}</template></strong> del carrito?
        </p>
        <template #footer>
          <Button label="Cancelar" severity="secondary" text @click="cancelRemoval" />
          <Button label="Eliminar" icon="pi pi-trash" severity="danger" @click="removeFromCart(pendingRemoval.id, pendingRemoval.variantId)" />
        </template>
      </Dialog>

      <Button
        v-if="!storeNotFound && !settingsLoading && storeIsOpen !== false"
        type="button"
        class="cart-fab"
        :class="{ 'cart-fab-with-orders': ordersCount > 0 }"
        icon="pi pi-shopping-cart"
        :badge="String(totalItems)"
        severity="secondary"
        badge-severity="primary"
        @click="cartOpen = true"
        :disabled="cartLoading"
        :aria-label="cartLoading ? 'Procesando carrito' : 'Abrir carrito'"
        :aria-busy="cartLoading"
        title="Carrito"
      />

      <Button
        v-if="!storeNotFound && !settingsLoading && ordersCount > 0"
        type="button"
        class="orders-fab"
        icon="pi pi-receipt"
        :badge="String(ordersCount)"
        severity="secondary"
        badge-severity="primary"
        aria-label="Abrir mis pedidos"
        title="Mis pedidos"
        @click="openOrderTracking()"
      />

      <Drawer
        v-if="!storeNotFound && !settingsLoading && storeIsOpen !== false"
        v-model:visible="cartOpen"
        position="right"
        class="cart-drawer"
        :style="storeThemeStyle"
        :modal="true"
        :block-scroll="true"
        :dismissable="!cartLoading"
        :show-close-icon="false"
      >
        <template #header>
          <div class="cart-header">
            <div>
              <p class="cart-eyebrow">Mi compra</p>
              <h3>Carrito</h3>
            </div>
            <Button icon="pi pi-times" text rounded severity="secondary" aria-label="Cerrar carrito" @click="cartOpen = false" />
          </div>
        </template>

        <Message v-if="cartError" severity="error" :closable="false" class="cart-error">
          <div class="cart-error-content">
            <span>{{ cartError }}</span>
            <Button label="Reintentar" icon="pi pi-refresh" :loading="cartLoading" @click="initializeCart" />
          </div>
        </Message>

        <div v-else-if="!cartToken" class="cart-empty-state" role="status">
          <ProgressSpinner stroke-width="4" />
          <span>Creando tu carrito...</span>
        </div>

        <Message v-else-if="cartItems.length === 0" severity="info" :closable="false" class="cart-empty-message">
          Tu carrito está vacío.
        </Message>

        <div v-if="cartToken && !cartError" class="cart-items">
          <article v-for="item in cartItems" :key="item.lineId" class="cart-item">
            <div class="cart-item-body">
              <div class="cart-item-header">
                <h4>{{ item.name }}</h4>
                <small v-if="item.variantLabel">{{ item.variantLabel }}</small>
                <strong>{{ formatCartAmount(item.pricePerType * item.quantity) }}</strong>
              </div>
              <div class="cart-item-controls">
                <Button
                  type="button"
                  :icon="item.quantity <= item.minQuantity ? 'pi pi-trash' : 'pi pi-minus'"
                  text
                  rounded
                  :disabled="cartLoading"
                  :aria-label="item.quantity <= item.minQuantity ? `Eliminar ${item.name} del carrito` : `Disminuir cantidad de ${item.name}`"
                  @click="item.quantity <= item.minQuantity ? promptRemoveFromCart(item.id, item.variantId, item.variantLabel) : updateCart(item.id, -1, item.variantId)"
                />
                <span>{{ formatCartQuantity(item.quantity, item) }}</span>
                <Button type="button" icon="pi pi-plus" text rounded :disabled="cartLoading || item.isSoldOut || item.quantity + item.step > getProductLimit(item, item.variantId)" :aria-label="`Aumentar cantidad de ${item.name}`" @click="updateCart(item.id, 1, item.variantId)" />
              </div>
            </div>
          </article>
        </div>

        <div v-if="cartToken && !cartError" class="cart-footer">
          <div class="cart-total">
            <span>Subtotal</span>
            <strong>{{ formatCartAmount(subtotal) }}</strong>
          </div>
          <div v-if="discountAmount > 0" class="cart-total cart-discount">
            <span>Descuentos</span>
            <strong>-{{ formatCartAmount(discountAmount) }}</strong>
          </div>
          <div class="cart-total">
            <span>Total</span>
            <strong>{{ formatCartAmount(totalAmount) }}</strong>
          </div>
          <Button
            type="button"
            class="checkout-btn"
            :disabled="cartLoading || cartItems.length === 0"
            label="Finalizar compra"
            icon="pi pi-arrow-right"
            icon-pos="right"
            :loading="cartLoading"
            :aria-label="cartLoading ? 'Procesando carrito' : 'Finalizar compra'"
            @click="beginCheckout"
          />
        </div>
      </Drawer>
      </template>
      <ScrollIndicators />
    </main>
  </body>
</template>

<style scoped>
  :global(html.product-page-open) {
    overflow: hidden;
  }

  :global(html),
  :global(body) {
    background-color: var(--store-background-color, #f6f5ef);
  }

  #app {
    --content-max-width: 1200px;
    --content-gutter: 5vw;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 0 2rem;
    background: var(--background-color);
    color: #1d1d1d;
  }

  #app.home-shell {
    min-height: 100vh;
    gap: 0;
    padding: 0;
    background: #f6f5ef;
  }

  .store-status {
    display: grid;
    min-height: 70vh;
    align-content: center;
    justify-items: center;
    gap: 0.8rem;
    text-align: center;
  }

  .store-status-message {
    display: flex;
    justify-content: center;
    width: min(100%, 38rem);
  }

  .store-status-message p {
    max-width: 42ch;
    margin: 0.7rem 0 1rem;
  }

  section {
    padding: 20px;
    width: clamp(300px, 90vw, var(--content-max-width));
    margin: 0 auto;
    border-radius: 20px;
  }
  #banner {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background-image:
      linear-gradient(var(--banner-overlay), var(--banner-overlay)),
      var(--banner-image);
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
    min-height: 25vh;
    color: var(--banner-text-color);
  }

  #banner .identity h1,
  #banner .store-slogan {
    text-shadow: var(--banner-text-shadow);
  }

  .delivery-badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--primary-color);
    border-radius: 6px;
    background: var(--primary-color);
    color: var(--p-primary-contrast-color);
    font-size: 0.82rem;
    font-weight: 800;
  }

  .store-banner-links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    margin-top: 1rem;
  }

  .banner-action {
    display: inline-flex;
    min-height: 2.5rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--secondary-color);
    border-radius: 6px;
    background: color-mix(in srgb, var(--secondary-color) 92%, transparent);
    color: var(--secondary-contrast-color);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .banner-action:hover {
    background: var(--secondary-color);
    color: var(--secondary-contrast-color);
  }

  .store-banner-links .banner-action.p-button.p-button-text:not(:disabled):hover {
    border-color: var(--secondary-color);
    background: var(--secondary-color);
    color: var(--secondary-contrast-color);
  }

  .banner-action:focus-visible {
    outline: 3px solid var(--p-focus-ring-color);
    outline-offset: 2px;
  }

  .store-closed-message {
    margin: 0.8rem 0 0;
    padding: 0.5rem 0.8rem;
    border: 1px solid var(--primary-color);
    border-radius: 6px;
    background: var(--primary-color);
    color: var(--p-primary-contrast-color);
    font-weight: 800;
  }

  .closed-orders-button {
    margin-top: 0.65rem;
  }

  .weekly-hours-list {
    display: grid;
    gap: 0.75rem;
  }

  .weekly-hours-empty {
    color: #536157;
    line-height: 1.5;
  }

  .weekly-hours-row {
    display: grid;
    grid-template-columns: minmax(7rem, 1fr) minmax(0, 1.5fr);
    gap: 0.8rem;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid #e1e6e1;
    font-size: 0.9rem;
  }

  .weekly-hours-row span {
    color: #536157;
    text-align: right;
  }

  .store-slogan {
    margin: 0.75rem 0 0;
    color: inherit;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.45;
  }
  .identity {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .identity-skeleton {
    gap: 0.8rem;
  }

  .banner-skeleton-slogan {
    margin-top: 1rem;
  }

  #banner.store-loading-state :deep(.p-skeleton),
  .product-skeleton-grid :deep(.p-skeleton) {
    background: #e5e7eb;
  }

  #banner.store-loading-state :deep(.p-skeleton)::after,
  .product-skeleton-grid :deep(.p-skeleton)::after {
    background: linear-gradient(90deg, transparent, #f3f4f6, transparent);
  }

  .logo {
    display: flex;
    width: 100px;
    height: 100px;
    padding: 10px;
    object-fit: contain;
    background-color: #fff;
    border: 3px solid var(--primary-color);
    border-radius: 50%;
  }

  .logo-fallback {
    align-items: center;
    justify-content: center;
    border-color: var(--primary-color);
    background-color: #f3f4f6;
    color: #6b7280;
  }

  .logo-fallback i {
    font-size: 3rem;
  }

  .banner-fallback-icon {
    position: absolute;
    top: 50%;
    right: clamp(1rem, 8vw, 7rem);
    color: rgba(107, 114, 128, 0.3);
    pointer-events: none;
    transform: translateY(-50%);
  }

  .banner-fallback-icon i {
    font-size: clamp(6rem, 14vw, 12rem);
  }
  #tools {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.2rem 1.4rem;
    border: 3px solid var(--primary-color);
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 12px 30px color-mix(in srgb, var(--primary-color) 16%, transparent);
  }

  .toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    justify-content: stretch;
    gap: 1rem;
  }

  #tools :deep(.toolbar-search.p-inputtext) {
    width: 100%;
    min-width: 0;
    min-height: 3.25rem;
    border-color: var(--primary-color);
    box-shadow: 0 6px 18px color-mix(in srgb, var(--primary-color) 18%, transparent);
  }

  #tools :deep(.toolbar-search.p-inputtext::placeholder) {
    color: var(--primary-text-color);
    opacity: 1;
  }

  #tools :deep(.toolbar-search.p-inputtext:enabled:hover) {
    border-color: var(--secondary-color);
  }

  #tools :deep(.toolbar-search.p-inputtext:enabled:focus) {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 22%, transparent);
  }

  .toolbar-selectors {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 1.25rem;
  }

  .sort-select {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    align-content: center;
    gap: 0.65rem;
    color: var(--primary-text-color);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .sort-select :deep(.p-select) {
    flex: 1 1 auto;
    min-width: 0;
    max-width: none;
    height: 3.25rem;
    border-color: color-mix(in srgb, var(--primary-color) 48%, #fff);
    background: #fff;
    color: var(--primary-text-color);
  }

  .category-filter {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
  }

  .category-filter-label {
    flex: 0 0 auto;
    color: var(--primary-text-color);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .category-arrow {
    display: none;
    flex: 0 0 auto;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--primary-color) 48%, #fff);
    border-radius: 999px;
    background: #fff;
    color: var(--primary-text-color);
    cursor: pointer;
  }

  .category-arrow:hover {
    background: color-mix(in srgb, var(--primary-color) 12%, #fff);
  }

  .category-arrow:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--primary-color) 45%, transparent);
    outline-offset: 2px;
  }

  /* Touch devices scroll with the finger; arrows are only for mouse users. */
  @media (hover: hover) and (pointer: fine) {
    .category-arrow {
      display: grid;
    }
  }

  .category-pills {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0.15rem 0.1rem;
    scroll-snap-type: x proximity;
    scrollbar-width: none !important;
    -ms-overflow-style: none;
  }

  .category-pills::-webkit-scrollbar {
    display: none !important;
    width: 0;
    height: 0;
  }

  .category-pill {
    flex: 0 0 auto;
    padding: 0.5rem 1rem;
    border: 1px solid color-mix(in srgb, var(--primary-color) 48%, #fff);
    border-radius: 999px;
    background: #fff;
    color: var(--primary-text-color);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    scroll-snap-align: start;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .category-pill:hover:not(:disabled) {
    background: color-mix(in srgb, var(--primary-color) 12%, #fff);
  }

  .category-pill.selected {
    border-color: var(--primary-color);
    background: var(--primary-color);
    color: var(--p-primary-contrast-color);
  }

  .category-pill:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--primary-color) 45%, transparent);
    outline-offset: 2px;
  }

  .category-pill:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .sort-select :deep(.p-select),
  .sort-select :deep(.p-multiselect),
  .sort-select :deep(.p-select-label),
  .sort-select :deep(.p-multiselect-label),
  .sort-select :deep(.p-multiselect-label .p-chip),
  .sort-value {
    font-size: 0.9rem;
  }

  .sort-select :deep(.p-select-label),
  .sort-select :deep(.p-select-dropdown),
  .sort-select :deep(.p-multiselect-label),
  .sort-select :deep(.p-multiselect-dropdown) {
    color: var(--primary-text-color);
  }

  .sort-select :deep(.p-select-label) {
    display: flex;
    height: 100%;
    align-items: center;
    padding-block: 0;
  }

  .sort-select :deep(.p-select:not(.p-disabled):hover),
  .sort-select :deep(.p-multiselect:not(.p-disabled):hover) {
    border-color: var(--secondary-color);
  }

  .sort-select :deep(.p-select:not(.p-disabled).p-focus),
  .sort-select :deep(.p-multiselect:not(.p-disabled).p-focus) {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 24%, transparent);
  }

  .sort-value {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    white-space: nowrap;
  }

  #products {
    width: clamp(300px, 90vw, var(--content-max-width));
    display: grid;
    gap: 1rem;
    padding: 0;
  }

  #products.products-grid {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  .promotions-section,
  .products-title {
    grid-column: 1 / -1;
    min-width: 0;
  }

  .products-title {
    margin: 0.5rem 0 0;
    color: var(--primary-text-color);
    font-size: 1.35rem;
  }

  .product-skeleton-grid {
    display: grid;
    width: 100%;
    grid-template-columns: inherit;
    gap: 1rem;
    grid-column: 1 / -1;
  }

  .skeleton-product-card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    box-shadow: none;
  }

  .skeleton-product-card :deep(.p-card-body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 0;
  }

  .skeleton-product-card :deep(.p-card-header),
  .skeleton-product-card :deep(.p-card-content) {
    padding: 0;
  }

  .skeleton-product-card :deep(.p-card-content) {
    display: flex;
    flex: 1;
  }

  .skeleton-product-image {
    width: 100%;
    height: 220px;
    flex: 0 0 auto;
    border-radius: 0;
  }

  .skeleton-product-body {
    display: flex;
    min-height: 100%;
    flex: 1;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1rem;
  }

  .skeleton-meta-row,
  .skeleton-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .skeleton-description {
    display: grid;
    gap: 0.45rem;
    min-height: 48px;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    border-radius: 16px;
    border: 2px solid var(--secondary-color);
    background: rgba(255, 255, 255, 0.8);
    color: #555;
    font-weight: 600;
  }

  .load-more-region {
    position: relative;
    display: grid;
    min-height: 3.5rem;
    place-items: center;
    grid-column: 1 / -1;
    padding: 0.5rem;
  }

  .load-more-region :deep(.p-button) {
    min-width: 13rem;
  }

  .load-more-sentinel {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }

  .cart-fab,
  .orders-fab {
    position: fixed;
    right: calc(max(var(--content-gutter), (100vw - var(--content-max-width)) / 2) + 0.5rem + var(--p-scrollbar-width, 0px));
    top: 1.5rem;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4.25rem;
    height: 4.25rem;
    border-radius: 1rem;
    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
  }

  .orders-fab {
    right: calc(max(var(--content-gutter), (100vw - var(--content-max-width)) / 2) + 5.25rem);
  }

  .cart-fab :deep(.p-button-icon),
  .orders-fab :deep(.p-button-icon) {
    margin: 0;
    font-size: 1.8rem;
    color: var(--primary-on-secondary-color) !important;
  }

  .cart-fab :deep(.p-badge),
  .orders-fab :deep(.p-badge) {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.25rem;
    border-radius: 999px;
    font-size: 0.68rem;
  }

  .cart-drawer :deep(.p-drawer) {
    width: min(90vw, 420px);
    max-width: 100vw;
    border-left: 3px solid var(--primary-color);
    background: var(--background-color);
  }

  .cart-drawer :deep(.p-drawer-content) {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .cart-drawer :deep(.p-drawer-header) {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid color-mix(in srgb, var(--primary-color) 35%, transparent);
  }

  .cart-header {
    display: flex;
    align-items: center;
    width: 100%;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .cart-header > div {
    flex: 1;
  }

  .cart-eyebrow {
    margin: 0 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.7rem;
    color: var(--primary-on-background-color);
  }

  .cart-header h3 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--primary-on-background-color);
  }

  .cart-empty-state {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: #4b5563;
    font-weight: 600;
  }

  .cart-empty-message {
    --p-message-info-background: var(--secondary-color);
    --p-message-info-border-color: var(--secondary-color);
    --p-message-info-color: var(--secondary-contrast-color);
    --p-message-text-color: var(--secondary-contrast-color);
    flex: 1;
    align-items: center;
    justify-content: center;
  }

  .cart-error {
    width: 100%;
  }

  .cart-error-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .cart-items {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    overflow: auto;
    padding: 1rem 0;
  }

  .cart-item {
    display: flex;
    padding: 0.7rem;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--primary-color) 30%, transparent);
    background: rgba(255, 255, 255, 0.8);
  }

  .cart-item-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.7rem;
  }

  .cart-item-header {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    align-items: stretch;
  }

  .cart-item-header h4 {
    margin: 0;
    font-size: 0.95rem;
    color: #111827;
  }

  .cart-item-header strong {
    align-self: flex-end;
    font-size: 0.85rem;
    color: #111827;
    text-align: right;
  }

  .cart-item-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.4rem 0.55rem;
    border-radius: 999px;
    background: white;
    border: 1px solid color-mix(in srgb, var(--primary-color) 30%, transparent);
    color: var(--primary-text-color);
  }

  .cart-item-controls :deep(.p-button) {
    --p-button-text-primary-color: var(--primary-text-color);
    --p-button-text-primary-hover-background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    --p-button-text-primary-active-background: color-mix(in srgb, var(--primary-color) 20%, transparent);
    color: var(--primary-text-color);
    width: 1.8rem;
    height: 1.8rem;
  }

  .cart-footer {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid color-mix(in srgb, var(--primary-color) 35%, transparent);
  }

  .cart-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: 0.95rem;
    color: #111827;
  }

  .cart-discount,
  .cart-discount strong {
    color: var(--status-success);
  }

  .cart-footer :deep(.checkout-btn) {
    width: 100%;
    justify-content: center;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);
  }

  @media (max-width: 1050px) {
    .toolbar {
      grid-template-columns: minmax(0, 1fr);
    }

    #tools :deep(.toolbar-search.p-inputtext) {
      width: 100%;
    }

    .toolbar-selectors {
      width: 100%;
      justify-content: space-between;
    }

  }

  @media (max-width: 700px) {
    .toolbar-selectors {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
      justify-items: stretch;
      gap: 0.75rem;
    }

    .sort-select {
      width: 100%;
      min-width: 0;
      min-height: 3.25rem;
      align-items: center;
      flex-direction: row;
      gap: 0.65rem;
      padding: 0;
      justify-content: flex-start;
    }

    .sort-select :deep(.p-select) {
      flex: 1 1 auto;
      width: 100%;
      max-width: none;
      min-width: 0;
    }
  }

  @media (max-width: 768px) {
    .cart-fab {
      right: calc(1rem + var(--p-scrollbar-width, 0px));
      bottom: 1rem;
      top: auto;
    }

    .orders-fab {
      right: calc(1rem + var(--p-scrollbar-width, 0px));
      bottom: 1rem;
      top: auto;
    }

    .cart-fab.cart-fab-with-orders {
      right: calc(6.25rem + var(--p-scrollbar-width, 0px));
    }

    .delivery-badge {
      top: 0.75rem;
      left: 0.75rem;
    }
  }

  @media (min-width: 500px) and (max-width: 900px) {
    #products.products-grid,
    #products.products-grid .product-skeleton-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 499px) {
    #products.products-grid,
    #products.products-grid .product-skeleton-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
    }

    .skeleton-product-card .skeleton-product-image {
      height: 150px;
    }

    .skeleton-product-card .skeleton-product-body {
      padding: 0.7rem;
    }
  }

</style>
