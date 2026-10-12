"use client"

import { useSyncExternalStore } from "react"

function partOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

const subscribe = () => () => {}

/**
 * The greeting, in the viewer clock. Home is rendered on the server, whose
 * timezone is not the reader, so the greeting is read in the browser; the
 * server render says something neutral so the two agree and React has nothing
 * to reconcile.
 */
export function HomeGreeting() {
  const greeting = useSyncExternalStore(subscribe, partOfDay, () => "Welcome")
  return <p className="text-sm text-muted-foreground">{greeting}</p>
}
