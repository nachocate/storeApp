export const LEGACY_STORAGE_PREFIX = 'vitrinapp-'
export const STORAGE_PREFIX = 'tiendario-'

// Moves data saved under the former app name so visitors keep their carts, orders and preferences.
export const migrateLegacyStorageKeys = (storage) => {
  if (!storage) return

  try {
    const legacyKeys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key) => key?.startsWith(LEGACY_STORAGE_PREFIX))

    for (const legacyKey of legacyKeys) {
      const key = `${STORAGE_PREFIX}${legacyKey.slice(LEGACY_STORAGE_PREFIX.length)}`
      const value = storage.getItem(legacyKey)
      if (storage.getItem(key) === null && value !== null) storage.setItem(key, value)
      storage.removeItem(legacyKey)
    }
  } catch {
    // Storage may be unavailable or full; the app still works with fresh keys.
  }
}

const getBrowserStorage = (name) => {
  try {
    return globalThis[name]
  } catch {
    return undefined
  }
}

export const migrateBrowserStorage = () => {
  migrateLegacyStorageKeys(getBrowserStorage('localStorage'))
  migrateLegacyStorageKeys(getBrowserStorage('sessionStorage'))
}
