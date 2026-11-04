/**
 * The chime that rings when a new notification arrives.
 *
 * Synthesised with the Web Audio API, so there is no sound file to ship or load.
 *
 * Two browser rules shape this:
 *
 *  - A page may not make sound until the person has touched it once (autoplay policy).
 *    `unlockSound` runs on the first click or key press anywhere in the app; before that,
 *    `playChime` stays silent instead of throwing. A person who opens the app and never
 *    touches it hears nothing, which is the browser's choice and cannot be worked around.
 *  - The sound is a per-browser preference, kept in localStorage, on by default. A blocked
 *    or unavailable storage means "on" and the choice simply is not remembered.
 *
 * It rings only when the unread count has GONE UP since the last check, never on the first
 * check after the page opens, so opening the app with old unread notices is silent.
 */

const SOUND_KEY = "spares.notificationSound"

/** Fired on window whenever the preference changes in this tab. */
const SOUND_CHANGE_EVENT = "spares:notification-sound-changed"

let audioContext: AudioContext | null = null

/** Whether the next unread count means "something new arrived". `null` = no earlier count yet. */
export function shouldRing(previous: number | null, next: number): boolean {
  return previous !== null && next > previous
}

/** The saved preference: on unless the person turned it off. */
export function isSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off"
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off")
  } catch {
    // Storage blocked: the choice lasts only until the page is reloaded.
  }
  window.dispatchEvent(new Event(SOUND_CHANGE_EVENT))
}

/** For useSyncExternalStore. */
export function subscribeSound(onChange: () => void): () => void {
  window.addEventListener(SOUND_CHANGE_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(SOUND_CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** Allow sound, from inside a click or key press. Safe to call any number of times. */
export function unlockSound(): void {
  if (typeof window === "undefined") return
  try {
    const Context =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return
    audioContext ??= new Context()
    if (audioContext.state === "suspended") void audioContext.resume()
  } catch {
    // No audio available (or blocked): the app works the same, silently.
  }
}

/** Two short rising notes. Silent when the preference is off or the browser has not allowed sound yet. */
export function playChime(): void {
  if (typeof window === "undefined" || !isSoundOn()) return
  const context = audioContext
  if (!context || context.state !== "running") return
  try {
    const start = context.currentTime
    for (const note of [
      { frequency: 880, at: 0 },
      { frequency: 1318.5, at: 0.16 },
    ]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = "sine"
      oscillator.frequency.value = note.frequency
      gain.gain.setValueAtTime(0.0001, start + note.at)
      gain.gain.exponentialRampToValueAtTime(0.25, start + note.at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + 0.5)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start + note.at)
      oscillator.stop(start + note.at + 0.55)
    }
  } catch {
    // A failed chime must never break the page.
  }
}
