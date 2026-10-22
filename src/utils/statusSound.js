const MUTE_STORAGE_KEY = 'vitrinapp-order-sound-muted'

export const isStatusSoundMuted = () => {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const setStatusSoundMuted = (muted) => {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // Preference only lives for this session when storage is unavailable.
  }
}

// Short two-note chime generated with Web Audio so no asset is needed.
export const playStatusChime = () => {
  if (typeof window === 'undefined' || isStatusSoundMuted()) return

  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextClass) return

  try {
    const context = new AudioContextClass()
    const start = context.currentTime
    ;[659.25, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const noteStart = start + index * 0.16

      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.exponentialRampToValueAtTime(0.15, noteStart + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.3)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(noteStart)
      oscillator.stop(noteStart + 0.32)
    })
    window.setTimeout(() => context.close(), 800)
  } catch {
    // Browsers may block audio before a user gesture; the visual update is enough.
  }
}
