"use client"

import { useEffect, useState } from "react"

import type { DraftLine } from "@/lib/assistant/request/lines"

/**
 * Requests saved as a draft, in this browser only (UAT, 27 Oct).
 *
 * A draft is the builder's state as the requester left it: the header and every
 * line with what was typed into it. It is **not a request**: it creates no
 * session, no line and no request reference, so nothing reaches the backend's
 * append-only tables and nothing can be typed into SAP until it is submitted.
 * Resuming re-checks every line with the backend, so the stock figures and the
 * suggestion are today's, never the ones that were saved.
 *
 * Kept in `localStorage`, so a draft exists only in the browser it was saved
 * in, and clearing site data loses it -- the screens say so. Every read and
 * write is guarded: storage can be blocked, full, or hold something written by
 * an older build, and none of that may stop a requester from submitting.
 */

export type RequestDraft = {
  id: string
  /** ISO timestamp. */
  savedAt: string
  requester: string
  /** The plant the department was picked for; the lines' own plant governs. */
  departmentPlant: string | null
  department: string
  departmentNote: string
  origin: "BADI" | "PLATFORM"
  /** Never a `pending` line: a line still being checked is not saved. */
  rows: DraftLine[]
}

const STORAGE_KEY = "assistant.request-drafts"
/** Enough for any one person's half-finished work; the oldest goes first. */
export const MAX_DRAFTS = 20

/** Fired on this tab when the drafts change; other tabs hear `storage`. */
const CHANGED_EVENT = "assistant:request-drafts"

function isDraft(value: unknown): value is RequestDraft {
  if (typeof value !== "object" || value === null) return false
  const d = value as Partial<RequestDraft>
  return typeof d.id === "string" && typeof d.savedAt === "string" && Array.isArray(d.rows)
}

/** Every saved draft, newest first. Empty when storage is unavailable or unreadable. */
export function readDrafts(): RequestDraft[] {
  if (typeof window === "undefined") return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(parsed)
      ? parsed.filter(isDraft).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      : []
  } catch {
    return []
  }
}

function writeDrafts(drafts: RequestDraft[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
    window.dispatchEvent(new Event(CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function getDraft(id: string): RequestDraft | null {
  return readDrafts().find((d) => d.id === id) ?? null
}

/** Saves (or replaces) one draft. False when the browser would not store it. */
export function saveDraft(draft: RequestDraft): boolean {
  const others = readDrafts().filter((d) => d.id !== draft.id)
  return writeDrafts([draft, ...others].slice(0, MAX_DRAFTS))
}

export function deleteDraft(id: string): void {
  const drafts = readDrafts()
  if (drafts.some((d) => d.id === id)) writeDrafts(drafts.filter((d) => d.id !== id))
}

/**
 * The drafts, kept current as they change here or in another tab. `null` until
 * mounted: the server has no browser storage, and rendering "no drafts" there
 * would flash before the real list.
 */
export function useRequestDrafts(): RequestDraft[] | null {
  const [drafts, setDrafts] = useState<RequestDraft[] | null>(null)
  useEffect(() => {
    const load = () => setDrafts(readDrafts())
    load()
    window.addEventListener(CHANGED_EVENT, load)
    window.addEventListener("storage", load)
    return () => {
      window.removeEventListener(CHANGED_EVENT, load)
      window.removeEventListener("storage", load)
    }
  }, [])
  return drafts
}
