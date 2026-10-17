/**
 * Where **demo** requests live: this browser's localStorage, and nowhere else.
 * Live requests are in the backend; nothing here is used then. The same
 * arrangement as `lib/assistant/demo/store.ts`, kept separate so the two can
 * be reset independently.
 */

import type { ApiRequest, ApiRequestLink } from "@/lib/api/assistant-requests"

const KEY = "spares-assistant-demo-requests-v2"
const EVENT = "spares-assistant-demo-requests-change"

let memory: Record<string, ApiRequest> | null = null

function read(): Record<string, ApiRequest> {
  if (memory) return memory
  try {
    const raw = window.localStorage.getItem(KEY)
    memory = raw ? (JSON.parse(raw) as Record<string, ApiRequest>) : {}
  } catch {
    memory = {}
  }
  return memory
}

function write(requests: Record<string, ApiRequest>): void {
  memory = requests
  try {
    window.localStorage.setItem(KEY, JSON.stringify(requests))
  } catch {
    // Storage refused. Kept in memory for this page.
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    // No window (tests).
  }
}

/** Newest first. */
export function allRequests(): ApiRequest[] {
  return Object.values(read()).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
}

export function getRequest(requestId: string): ApiRequest | undefined {
  return read()[requestId.trim().toUpperCase()]
}

export function findByKey(idempotencyKey: string): ApiRequest | undefined {
  return allRequests().find((r) => (r as ApiRequest & { idempotencyKey?: string }).idempotencyKey === idempotencyKey)
}

export function saveRequest(request: ApiRequest): void {
  write({ ...read(), [request.requestId]: request })
}

/** Record a simulated reservation against one line. */
export function addLink(requestId: string, lineNo: number, link: ApiRequestLink): void {
  const request = getRequest(requestId)
  if (!request) return
  saveRequest({
    ...request,
    lines: request.lines.map((line) =>
      line.lineNo === lineNo ? { ...line, linkedReservations: [...line.linkedReservations, link] } : line
    ),
  })
}

export function clearLinks(requestId: string): void {
  const request = getRequest(requestId)
  if (!request) return
  saveRequest({ ...request, lines: request.lines.map((line) => ({ ...line, linkedReservations: [] })) })
}

/** The next simulated reservation number, unique across every demo request. */
export function nextReservationNumber(): string {
  const taken = allRequests().reduce(
    (count, r) => count + r.lines.reduce((n, l) => n + l.linkedReservations.length, 0),
    0
  )
  return String(99100001 + taken)
}

export function resetRequests(): void {
  write({})
}

export function subscribe(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
