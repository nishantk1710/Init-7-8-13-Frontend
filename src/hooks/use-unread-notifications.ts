"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getUnreadCount } from "@/lib/api/notifications"
import { UNREAD_CHANGED_EVENT } from "@/lib/notifications"
import { playChime, shouldRing, unlockSound } from "@/lib/notification-sound"

const REFRESH_MS = 60_000

/**
 * How many notifications the signed-in user has not read, for the sidebar badge.
 *
 * Fetched on mount, every minute, and whenever the inbox says something changed.
 * A failed request keeps the last count: a badge that vanishes on a network blip
 * would be worse than one a minute out of date.
 *
 * Also rings (lib/notification-sound.ts) when the count has gone up since the last
 * check -- a new notification arrived. Never on the first check, so opening the app with
 * old unread notices is silent.
 */
export function useUnreadNotifications(): number {
  const [unread, setUnread] = useState(0)
  // The count at the last successful check; null until there has been one.
  const previous = useRef<number | null>(null)

  const refresh = useCallback(() => {
    getUnreadCount()
      .then((result) => {
        if (shouldRing(previous.current, result.unread)) playChime()
        previous.current = result.unread
        setUnread(result.unread)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener(UNREAD_CHANGED_EVENT, refresh)
    // Browsers only allow sound after the person has touched the page once.
    window.addEventListener("pointerdown", unlockSound, { once: true })
    window.addEventListener("keydown", unlockSound, { once: true })
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(UNREAD_CHANGED_EVENT, refresh)
      window.removeEventListener("pointerdown", unlockSound)
      window.removeEventListener("keydown", unlockSound)
    }
  }, [refresh])

  return unread
}
