/**
 * Minimal client for the FastAPI backend.
 *
 * One base URL, one place that adds the identity header, one place that parses
 * an error body. Configure the base URL with NEXT_PUBLIC_API_BASE_URL (see
 * .env.example).
 *
 * ## The error shape, which is not what you would guess
 *
 * FastAPI returns **two different things** under `detail`, both with status 422,
 * and the difference is not cosmetic:
 *
 *   - a pydantic validation failure sends an ARRAY of issues:
 *       {"detail": [{"type": "missing", "loc": ["body", "plant"],
 *                    "msg": "Field required", "input": {...}}]}
 *   - an application `HTTPException` sends a STRING:
 *       {"detail": "quantity must be a number, got 'abc'"}
 *
 * Both were observed against the real app. Code that assumes a string renders
 * `[object Object]` on the commonest failure there is — a required field left
 * empty — so `ApiError` models both arms and exposes them separately:
 * `detailText()` for a sentence to show, `fieldErrors()` for per-field messages
 * on a form.
 */

import { ACTOR_ID_HEADER, currentActorId } from "@/lib/api/actor"
import { currentDataMode } from "@/lib/data-mode"

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api"

/** One issue from a pydantic validation failure. */
export type ValidationIssue = {
  type: string
  /** Path to the offending value, e.g. `["body", "plant"]` or `["query", "limit"]`. */
  loc: (string | number)[]
  msg: string
  input?: unknown
  ctx?: Record<string, unknown>
}

/** The two arms `detail` can take. `null` when the body was not JSON at all. */
export type ApiErrorDetail = string | ValidationIssue[] | null

function isValidationIssueArray(value: unknown): value is ValidationIssue[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "msg" in item &&
        "loc" in item &&
        Array.isArray((item as ValidationIssue).loc)
    )
  )
}

export class ApiError extends Error {
  /**
   * `detail` is optional so the two existing call sites that construct an
   * ApiError with (message, status) keep working unchanged.
   */
  constructor(
    message: string,
    readonly status: number,
    /** Machine-readable code from the backend's {error:{code,message,details}}
     * envelope (see app/schemas/i7/errors.py), when the response body parsed
     * as that shape. Undefined for a network failure or a non-JSON body. */
    readonly code?: string,
    readonly detail: ApiErrorDetail = null
  ) {
    super(message)
    this.name = "ApiError"
  }

  /**
   * A sentence fit to show a user, whichever arm `detail` took.
   *
   * The array arm is flattened to `field: message` lines rather than to the raw
   * `msg` alone, because "Field required" on its own does not say which field.
   * Falls back to the HTTP-level message when there is no detail — never to a
   * bare status code, which tells a planner nothing.
   */
  detailText(): string {
    if (typeof this.detail === "string" && this.detail.length > 0) {
      return this.detail
    }
    if (isValidationIssueArray(this.detail) && this.detail.length > 0) {
      return this.detail
        .map((issue) => {
          const field = fieldNameOf(issue)
          return field ? `${field}: ${issue.msg}` : issue.msg
        })
        .join("\n")
    }
    return this.message
  }

  /**
   * Per-field messages, for rendering against the input that caused them.
   *
   * Keyed by the LAST element of `loc` — pydantic sends `["body", "plant"]` and
   * a form knows its field as `plant`. Only the array arm produces entries; a
   * string detail is not attributable to a field and belongs in `detailText()`.
   */
  fieldErrors(): Record<string, string> {
    if (!isValidationIssueArray(this.detail)) return {}
    const errors: Record<string, string> = {}
    for (const issue of this.detail) {
      const field = fieldNameOf(issue)
      // First issue per field wins. Pydantic can report several on one value
      // and stacking them in a form field turns a hint into a paragraph.
      if (field && !(field in errors)) errors[field] = issue.msg
    }
    return errors
  }
}

/** The field a validation issue is about: the last path element that is a name. */
function fieldNameOf(issue: ValidationIssue): string | null {
  for (let i = issue.loc.length - 1; i >= 0; i -= 1) {
    const part = issue.loc[i]
    // Skip array indices ("body", "items", 0) and the section marker itself.
    if (typeof part === "string" && part !== "body" && part !== "query") {
      return part
    }
  }
  return null
}

/**
 * Read the error body without letting the read itself throw.
 *
 * A 500 from the exception handler is JSON, but a proxy timeout or a CORS
 * rejection is not, and failing to parse the body of a failure must not replace
 * the real failure with a JSON syntax error.
 */
async function readErrorDetail(response: Response): Promise<ApiErrorDetail> {
  try {
    const body: unknown = await response.json()
    if (typeof body === "object" && body !== null && "detail" in body) {
      const detail = (body as { detail: unknown }).detail
      if (typeof detail === "string") return detail
      if (isValidationIssueArray(detail)) return detail
      // The I13 snapshot's 503 sends {status, message}; keep the sentence.
      if (typeof detail === "object" && detail !== null && "message" in detail) {
        const message = (detail as { message: unknown }).message
        if (typeof message === "string") return message
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * How long a GET may take before it is abandoned, in milliseconds.
 *
 * Without one, a hung backend held a server-rendered page until Node's own
 * ~5-minute header timeout and then failed with a bare "fetch failed". POSTs
 * get no default timeout: every one writes to an append-only table, and giving
 * up on a write that may have landed is worse than waiting for it.
 */
export const API_GET_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_GET_TIMEOUT_MS ?? 20000)

/**
 * The backend answers 503 with `Retry-After` while the I13 snapshot is still
 * being built after a restart (about a minute). Said as that, not as a fault.
 */
function preparingMessage(response: Response): string {
  const retry = response.headers.get("Retry-After")
  return (
    "The backend is still preparing this data after a restart — this takes about a minute. " +
    `Reload the page${retry ? ` in ${retry} seconds` : " shortly"}.`
  )
}

/**
 * Every call to the backend goes through here, which makes this the one place
 * demo mode (lib/data-mode.ts) has to intervene: in demo mode the recorded
 * dataset answers instead of the network, with a real `Response`, so the error
 * handling below applies to both modes unchanged.
 */
async function request(path: string, init?: RequestInit): Promise<Response> {
  const relative = path.startsWith("/") ? path : `/${path}`
  const method = init?.method ?? "GET"

  if ((await currentDataMode()) === "demo") {
    // Imported on demand: live mode never downloads the resolver or the index.
    const { resolveMock } = await import("@/mocks/resolve")
    return checked(await resolveMock(relative, init), method, `demo:${relative}`)
  }

  const url = `${API_BASE_URL}${relative}`
  const signal =
    init?.signal ?? (method === "GET" && API_GET_TIMEOUT_MS > 0 ? AbortSignal.timeout(API_GET_TIMEOUT_MS) : undefined)

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      signal,
      headers: {
        "Content-Type": "application/json",
        [ACTOR_ID_HEADER]: currentActorId(),
        ...init?.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(
        `The backend did not respond within ${Math.round(API_GET_TIMEOUT_MS / 1000)} seconds (${method} ${url}).`,
        504
      )
    }
    throw error
  }

  return checked(response, method, url)
}

/** Throw ApiError for a non-2xx response; return it otherwise. */
async function checked(response: Response, method: string, url: string): Promise<Response> {
  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new ApiError(
      response.status === 503 && response.headers.get("Retry-After")
        ? preparingMessage(response)
        : `${method} ${url} failed with ${response.status}`,
      response.status,
      detail
    )
  }
  return response
}

/**
 * Fetch a JSON resource from the backend. Throws ApiError on a non-2xx response.
 *
 * Sends the identity header on every request, including GETs — the backend reads
 * it on read routes too (the ACT routes log who looked), and a header that is
 * only sometimes present is harder to reason about than one that always is.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init)

  // 204 has no body. Nothing in this API returns one today, but a JSON parse of
  // an empty body throws a SyntaxError that reads as a server fault rather than
  // as the success it is.
  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}

/**
 * The raw `Response`, for a body that is not JSON (the Excel export).
 * Throws ApiError on a non-2xx response, and honours demo mode, like the rest.
 */
export function apiFetchResponse(path: string, init?: RequestInit): Promise<Response> {
  return request(path, init)
}

/** A list response together with the population total the backend reported. */
export type ApiList<T> = {
  items: T[]
  /** `X-Total-Count`, or `null` when the route does not send one. */
  total: number | null
  headers: Headers
}

/**
 * GET a bare-array list and read `X-Total-Count` alongside it.
 *
 * The I13 list routes keep their bare-array bodies (so no existing caller's
 * shape changed) and report the unpaged total in that header, which is what
 * lets a screen say "1,000 of 42,649" instead of "there may be more".
 */
export async function apiFetchList<T>(path: string, init?: RequestInit): Promise<ApiList<T>> {
  const response = await request(path, init)
  const items = (await response.json()) as T[]
  const header = response.headers.get("X-Total-Count")
  const total = header === null ? null : Number(header)
  return { items, total: Number.isFinite(total) ? total : null, headers: response.headers }
}

/**
 * POST a JSON body and read a JSON response.
 *
 * **No retry, deliberately.** Every POST in this application writes to an
 * append-only table. A retry after a timeout that actually succeeded writes a
 * second row that nobody can delete — two sessions for one conversation, or a
 * justification recorded twice against one decision. Callers that want a retry
 * must decide that for themselves, per endpoint, knowing what a duplicate costs.
 */
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export type HealthResponse = {
  status: string
  service: string
}

/** Calls GET /api/health. Used to verify frontend -> backend connectivity. */
export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health")
}
