export const normalizeFulfillmentWindowId = (value) => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return value

  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) ? numericValue : value
}