"use client"

import { useCallback, useEffect, useState } from "react"

import { getUnreadCount } from "@/lib/api/notifications"
import { UNREAD_CHANGED_EVENT } from "@/lib/notifications"

const REFRESH_MS = 60_000

/**
 * How many notifications the signed-in user has not read, for the sidebar badge.
 *
 * Fetched on mount, every minute, and whenever the inbox says something changed.
 * A failed request keeps the last count: a badge that vanishes on a network blip
 * would be worse than one a minute out of date.
 */
export function useUnreadNotifications(): number {
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(() => {
    getUnreadCount()
      .then((result) => setUnread(result.unread))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener(UNREAD_CHANGED_EVENT, refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(UNREAD_CHANGED_EVENT, refresh)
    }
  }, [refresh])

  return unread
}
