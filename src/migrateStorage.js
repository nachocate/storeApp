import { migrateBrowserStorage } from './utils/legacyStorage.js'

// Imported before App.vue because some modules read storage while they are evaluated.
migrateBrowserStorage()
