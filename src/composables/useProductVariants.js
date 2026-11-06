import { computed, ref, watch } from 'vue'

export const getAvailableVariants = (product) =>
  (product?.variantConfiguration?.variants ?? []).filter((variant) => variant.available)

export const useProductVariants = (getProduct) => {
  const product = computed(getProduct)
  const variantOptions = computed(() => product.value?.variantConfiguration?.options ?? [])
  const variants = computed(() => product.value?.variantConfiguration?.variants ?? [])
  const availableVariants = computed(() => getAvailableVariants(product.value))
  const singleAvailableVariant = computed(() =>
    availableVariants.value.length === 1 ? availableVariants.value[0] : null
  )
  const selectedOptions = ref({})

  watch(() => [product.value?.id, product.value?.variantConfiguration?.variants], () => {
    selectedOptions.value = {}
  }, { immediate: true })

  const selectedVariant = computed(() => {
    if (variantOptions.value.some((option) => !selectedOptions.value[option.name])) return null

    return variants.value.find((variant) =>
      variant.available && variant.selections.every((selection) =>
        selectedOptions.value[selection.optionName] === selection.value
      )
    ) ?? null
  })

  const canSelectValue = (optionIndex, option, value) => {
    const precedingOptions = variantOptions.value.slice(0, optionIndex)
    return variants.value.some((variant) =>
      variant.available && variant.selections.some((selection) =>
        selection.optionName === option.name && selection.value === value.label
      ) && precedingOptions.every((precedingOption) =>
        !selectedOptions.value[precedingOption.name] ||
        variant.selections.some((selection) =>
          selection.optionName === precedingOption.name &&
          selection.value === selectedOptions.value[precedingOption.name]
        )
      )
    )
  }

  const selectOption = (optionIndex, option, value) => {
    if (!canSelectValue(optionIndex, option, value)) return

    const nextOptions = { ...selectedOptions.value, [option.name]: value.label }
    const compatibleVariant = variants.value.find((variant) =>
      variant.available && variantOptions.value
        .slice(0, optionIndex + 1)
        .every((selectedOption) =>
          variant.selections.some((selection) =>
            selection.optionName === selectedOption.name &&
            selection.value === nextOptions[selectedOption.name]
          )
        )
    )
    if (!compatibleVariant) return
    selectedOptions.value = nextOptions
  }

  return {
    availableVariants,
    canSelectValue,
    selectedOptions,
    selectedVariant,
    selectOption,
    singleAvailableVariant,
    variantOptions,
    variants
  }
}
