/**
 * Answers a backend request from the recorded demo dataset.
 *
 * Called by lib/api/client.ts in demo mode (lib/data-mode.ts) in place of
 * `fetch`, and returns a real `Response`, so everything downstream -- error
 * parsing, X-Total-Count, the Excel download -- behaves exactly as live.
 *
 * GET, in order:
 *   1. the response recorded for exactly this request;
 *   2. otherwise the closest recording of the same route, narrowed to the rows
 *      the request's filters select (see `narrow`) -- the recording cannot
 *      hold every filter combination a user might click;
 *   3. otherwise 404 with a sentence saying the record is not in the demo
 *      dataset, which every screen already knows how to show.
 *
 * Anything else is a write. Demo mode never writes: the assistant replays a
 * scripted conversation (./assistant.ts), and every other write is refused
 * with 403 and a sentence, so a demo can never leave a row behind in an
 * append-only table, nor pretend to have saved something it did not.
 */

import {
  answerAssistantTurn,
  askAssistant,
  assistantSessionTrace,
  startAssistantSession,
  type MockReply,
} from "@/mocks/assistant"
import { mockKey, normalisePathname } from "@/mocks/key"
import type { RecordedResponse } from "@/mocks/types"

type Dataset = Map<string, RecordedResponse>

let dataset: Promise<Dataset> | null = null

/**
 * The recorded dataset, indexed by request key. One file
 * (demo-dataset.json, built by `npm run mock:record -- bundle`), imported on
 * first use so live mode never downloads it.
 */
function recordings(): Promise<Dataset> {
  dataset ??= import("@/mocks/demo-dataset.json").then(
    (module) =>
      new Map(
        (module.default as { recordings: RecordedResponse[] }).recordings.map((r) => [r.key, r])
      )
  )
  return dataset
}

export const DEMO_WRITE_MESSAGE =
  "Demo mode: changes are not saved. Switch to Live data in the sidebar to do this for real."

export const DEMO_MISSING_MESSAGE =
  "This record is not in the demo dataset. Switch to Live data in the sidebar to load it."

export async function resolveMock(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase()
  const [rawPathname, search = ""] = path.split("?", 2)
  const pathname = normalisePathname(rawPathname)

  if (method !== "GET") return reply(write(pathname, parseBody(init?.body)))

  const all = await recordings()
  const exact = all.get(mockKey("GET", path))
  if (exact) return fromRecording(exact)

  const assistantTrace = /^\/assistant\/sessions\/([^/]+)$/.exec(pathname)
  if (assistantTrace) {
    const trace = assistantSessionTrace(decodeURIComponent(assistantTrace[1]))
    if (trace) return reply(trace)
  }

  const nearest = nearestRecording(all, pathname, new URLSearchParams(search))
  if (nearest) return fromRecording(narrow(nearest.recording, new URLSearchParams(search), nearest.params))

  return reply({ status: 404, body: { detail: DEMO_MISSING_MESSAGE } })
}

// --- writes -----------------------------------------------------------------

function write(pathname: string, body: Record<string, unknown>): MockReply {
  if (pathname === "/assistant/sessions") return startAssistantSession(body)
  const turn = /^\/assistant\/sessions\/([^/]+)\/turns$/.exec(pathname)
  if (turn) {
    const answer = (body.answer ?? {}) as Record<string, unknown>
    return answerAssistantTurn(decodeURIComponent(turn[1]), answer)
  }
  if (pathname === "/assistant/ask") return askAssistant()
  return { status: 403, body: { detail: DEMO_WRITE_MESSAGE } }
}

function parseBody(body: RequestInit["body"]): Record<string, unknown> {
  if (typeof body !== "string") return {}
  try {
    const parsed: unknown = JSON.parse(body)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// --- GET fallback -----------------------------------------------------------

type Candidate = { recording: RecordedResponse; params: URLSearchParams }

/**
 * Recordings of the same route, best first: the one sharing the most query
 * values with the request, then the one with the fewest parameters of its own
 * (the broadest data to narrow from).
 */
function nearestRecording(all: Dataset, pathname: string, wanted: URLSearchParams): Candidate | null {
  let best: { candidate: Candidate; score: number } | null = null
  const prefix = `GET ${pathname}`
  for (const [key, recording] of all) {
    if (key !== prefix && !key.startsWith(`${prefix}?`)) continue
    const params = new URLSearchParams(key.slice(prefix.length + 1))
    let shared = 0
    for (const [name, value] of params) if (wanted.get(name) === value) shared += 1
    const score = shared * 100 - [...params.keys()].length
    if (!best || score > best.score) best = { candidate: { recording, params }, score }
  }
  return best?.candidate ?? null
}

/** Paging, sorting and switches: not something a row can be matched against. */
const NOT_FILTERS = new Set([
  "page",
  "page_size",
  "pageSize",
  "limit",
  "offset",
  "sort",
  "sort_desc",
  "live",
  "include_out_of_scope",
  "screen",
])

const PAGE_PARAMS = ["page", "offset"]

type Row = Record<string, unknown>
const LIST_FIELDS = ["items", "rows", "data", "results", "recommendations", "sessions", "reports"]
const TOTAL_FIELDS = ["total", "total_count", "totalCount", "count"]

/**
 * Narrow a fallback recording to what the request's filters select.
 *
 * A filter narrows only when the rows carry a field of that name (as sent,
 * camelCased or snake_cased) and the recording was not already filtered on it.
 * Anything it cannot match -- a boolean switch, a derived field -- is left
 * alone: showing the recorded rows beats showing an empty table for a filter
 * the demo cannot evaluate. A page beyond the first shows no rows rather than
 * the first page again.
 */
function narrow(recording: RecordedResponse, wanted: URLSearchParams, had: URLSearchParams): RecordedResponse {
  const located = locateRows(recording.body)
  if (!located) return recording

  let rows = located.rows
  for (const [name, value] of wanted) {
    if (NOT_FILTERS.has(name) || value === "" || had.get(name) === value) continue
    if (value === "true" || value === "false") continue
    if (name === "search") {
      const needle = value.toLowerCase()
      rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle))
      continue
    }
    const field = fieldFor(rows, name)
    if (!field) continue
    rows = rows.filter((row) => String(row[field] ?? "").toLowerCase() === value.toLowerCase())
  }

  const beyondFirstPage = PAGE_PARAMS.some((name) => {
    const value = Number(wanted.get(name) ?? "0")
    return name === "page" ? value > 1 : value > 0
  })
  const shown = beyondFirstPage ? [] : rows
  if (shown === located.rows) return recording

  const body = located.put(shown, rows.length)
  const headers = { ...recording.headers }
  if ("x-total-count" in headers) headers["x-total-count"] = String(rows.length)
  return { ...recording, body, headers }
}

function locateRows(
  body: unknown
): { rows: Row[]; put: (rows: Row[], total: number) => unknown } | null {
  if (Array.isArray(body)) return { rows: body as Row[], put: (rows) => rows }
  if (!body || typeof body !== "object") return null
  const envelope = body as Row
  const field = LIST_FIELDS.find((name) => Array.isArray(envelope[name]))
  if (!field) return null
  return {
    rows: envelope[field] as Row[],
    put: (rows, total) => {
      const next: Row = { ...envelope, [field]: rows }
      for (const name of TOTAL_FIELDS) if (typeof next[name] === "number") next[name] = total
      return next
    },
  }
}

function fieldFor(rows: Row[], param: string): string | null {
  const sample = rows[0]
  if (!sample) return null
  const camel = param.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  const snake = param.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  const names = [param, camel, snake, `${camel}Id`, `${snake}_id`]
  return names.find((name) => name in sample) ?? null
}

// --- responses --------------------------------------------------------------

function fromRecording(recording: RecordedResponse): Response {
  const headers = new Headers({ ...recording.headers, "content-type": recording.contentType })
  if (recording.encoding === "base64") {
    const binary = atob(recording.body as string)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new Response(bytes, { status: recording.status, headers })
  }
  return new Response(JSON.stringify(recording.body), { status: recording.status, headers })
}

function reply({ status, body }: MockReply): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}
