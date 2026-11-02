/**
 * Minimal client for the FastAPI backend.
 *
 * One base URL, one place that adds the identity, one place that parses an
 * error body. Configure the base URL with NEXT_PUBLIC_API_BASE_URL (see
 * .env.example).
 *
 * ## Identity
 *
 * With Microsoft sign-in on (AUTH_MODE=entra) every request carries the user's
 * access token as `Authorization: Bearer`, from the server and from the browser
 * alike (see lib/api/token.ts); the backend takes the user and their roles from
 * it. Otherwise -- the test sign-in -- it carries the `X-Actor-Id` header as it
 * always has. Feature code never sets either.
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
import { currentAccessToken } from "@/lib/api/token"

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
    readonly detail: ApiErrorDetail = null,
    /** `detail` exactly as the body sent it, when it was an object. Routes
     * that answer with structure -- the multi-material request's
     * `{message, line}` and `{message, changed}` -- are read from here;
     * `detail` keeps only the message. */
    readonly rawDetail: unknown = null
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

/** What a failed response's body said. */
type ErrorBody = {
  detail: ApiErrorDetail
  /** The I07 envelope's machine-readable `error.code`, when the body was that shape. */
  code?: string
  /** `detail` as sent, when it was an object. */
  raw?: unknown
  /** The snapshot 503's `status` ("building" or "failed"); null on any other body. */
  snapshotStatus: string | null
}

/**
 * Read the error body without letting the read itself throw.
 *
 * A 500 from the exception handler is JSON, but a proxy timeout or a CORS
 * rejection is not, and failing to parse the body of a failure must not replace
 * the real failure with a JSON syntax error.
 */
async function readErrorBody(response: Response): Promise<ErrorBody> {
  try {
    const body: unknown = await response.json()
    // The I07 routes answer {error: {code, message, details}} (app/schemas/i7/errors.py), not FastAPI's
    // {detail}. Without this a refused request read as "failed with 409" and the reason -- which the
    // backend wrote for the person looking at the screen -- never reached it.
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = (body as { error: unknown }).error
      if (typeof error === "object" && error !== null && "message" in error) {
        const { code, message } = error as { code?: unknown; message: unknown }
        if (typeof message === "string") {
          return {
            detail: message,
            code: typeof code === "string" ? code : undefined,
            snapshotStatus: null,
            raw: error,
          }
        }
      }
    }
    if (typeof body === "object" && body !== null && "detail" in body) {
      const detail = (body as { detail: unknown }).detail
      if (typeof detail === "string") return { detail, snapshotStatus: null }
      if (isValidationIssueArray(detail)) return { detail, snapshotStatus: null }
      // The I08/I13 snapshot's 503 sends {status, message}; keep both.
      if (typeof detail === "object" && detail !== null && "message" in detail) {
        const { message, status } = detail as { message: unknown; status?: unknown }
        if (typeof message === "string") {
          return { detail: message, snapshotStatus: typeof status === "string" ? status : null, raw: detail }
        }
      }
    }
    return { detail: null, snapshotStatus: null }
  } catch {
    return { detail: null, snapshotStatus: null }
  }
}

/**
 * How long a GET may take before it is abandoned, in milliseconds.
 *
 * Without one, a hung backend held a server-rendered page until Node's own
 * ~5-minute header timeout and then failed with a bare "fetch failed". POSTs
 * get no default timeout: every one writes to an append-only table, and giving
 * up on a write that may have landed is worse than waiting for it.
 *
 * 60 s by default. 20 s was too tight: on 13 Oct 2026 the I13 summary answered
 * in 1 s one moment and 24 s the next while Azure SQL was busy, and every
 * slow-but-healthy answer showed as "the live backend is not responding".
 * Azure App Service cuts any request at 230 s, so going much higher buys
 * nothing. Set at build time (NEXT_PUBLIC_*): repository variable
 * API_GET_TIMEOUT_MS in deploy.yml.
 */
export const API_GET_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_GET_TIMEOUT_MS || 60000)

/**
 * `RequestInit` plus a per-call timeout.
 *
 * The default suits a read that should be quick, and most of them are. One is
 * not: the coding screen's model pass is seconds of model time PER MATERIAL,
 * and it is opted into deliberately. Rather than raise the global ceiling for
 * every read -- which would turn a dead backend into a long wait everywhere --
 * that one caller asks for the headroom it needs.
 *
 * **There is a ceiling above this one that we do not own.** Azure App Service
 * ends a request at about 230 seconds and answers 504 itself, so no value here
 * buys more than that. A call that cannot finish inside it has to be split,
 * not given a bigger number.
 */
export type ApiRequestInit = RequestInit & { timeoutMs?: number }

/**
 * The backend answers 503 with `Retry-After` while an I08 or I13 snapshot is
 * unavailable, for one of two reasons the body tells apart:
 *
 *   - `building`: still being built after a restart (about a minute). Said as
 *     that, not as a fault.
 *   - `failed`: the last build errored, and the backend retries it at most once
 *     a minute. Calling this "still preparing" hid a build that failed on every
 *     attempt behind a message that promised it would clear by itself.
 */
function unavailableMessage(response: Response, body: ErrorBody): string {
  const retry = response.headers.get("Retry-After")
  const when = retry ? ` in ${retry} seconds` : " shortly"
  if (body.snapshotStatus === "failed") {
    // The backend names its initiative ("I13 data could not be prepared: ...");
    // screens never show initiative numbers.
    const reason =
      typeof body.detail === "string"
        ? body.detail.replace(/^I0?(8|13) data\b/, "This data")
        : "The backend could not prepare this data"
    return (
      `${reason}. The backend retries at most once a minute — reload the page${when}. ` +
      "If this keeps happening, the backend log has the cause."
    )
  }
  return (
    "The backend is still preparing this data after a restart — this takes about a minute. " +
    `Reload the page${when}.`
  )
}

async function request(path: string, init?: ApiRequestInit): Promise<Response> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
  const method = init?.method ?? "GET"
  // A caller's own timeout wins over the global GET default. Carried as a
  // NUMBER rather than as a ready-made signal so the error message below can
  // quote the limit that actually bit -- a call given 180 seconds reporting
  // "did not respond within 60 seconds" sends the reader after the wrong bug.
  const timeoutMs = init?.timeoutMs ?? (method === "GET" ? API_GET_TIMEOUT_MS : 0)
  const signal =
    init?.signal ?? (timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined)
  const token = await currentAccessToken()

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      signal,
      headers: {
        // A multipart body sets its own Content-Type, boundary included.
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        // Signed in with Microsoft: the token says who this is, and the backend
        // ignores X-Actor-Id. Test sign-in: the header, as before.
        ...(token ? { Authorization: `Bearer ${token}` } : { [ACTOR_ID_HEADER]: currentActorId() }),
        ...init?.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(
        `The backend did not respond within ${Math.round(timeoutMs / 1000)} seconds (${method} ${url}).`,
        504
      )
    }
    throw error
  }

  if (!response.ok) {
    // A token the backend no longer accepts (expired session, revoked access):
    // send the browser to sign in again and come back here, rather than show
    // an error the user can do nothing about.
    if (response.status === 401 && token && typeof window !== "undefined") {
      const here = `${window.location.pathname}${window.location.search}`
      window.location.assign(`/login?next=${encodeURIComponent(here)}`)
    }
    const body = await readErrorBody(response)
    throw new ApiError(
      response.status === 503 && response.headers.get("Retry-After")
        ? unavailableMessage(response, body)
        : `${method} ${url} failed with ${response.status}`,
      response.status,
      body.code,
      body.detail,
      body.raw ?? null
    )
  }
  return response
}

/**
 * Fetch a JSON resource from the backend. Throws ApiError on a non-2xx response.
 *
 * Sends the identity (token or header) on every request, including GETs — the
 * backend reads it on read routes too (with sign-in on, every read needs it; the
 * ACT routes log who looked), and an identity that is only sometimes present is
 * harder to reason about than one that always is.
 */
export async function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const response = await request(path, init)

  // 204 has no body. Nothing in this API returns one today, but a JSON parse of
  // an empty body throws a SyntaxError that reads as a server fault rather than
  // as the success it is.
  if (response.status === 204) return undefined as T

  return (await response.json()) as T
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
export async function apiFetchList<T>(path: string, init?: ApiRequestInit): Promise<ApiList<T>> {
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

/**
 * POST a multipart form (a file upload) and read a JSON response. No retry,
 * for the same reason as {@link apiPost}.
 */
export async function apiPostForm<T>(path: string, body: FormData): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body })
}

export type HealthResponse = {
  status: string
  service: string
}

/** Calls GET /api/health. Used to verify frontend -> backend connectivity. */
export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health")
}
