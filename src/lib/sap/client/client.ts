// W2.1 — the CPI client. Every SAP call in this system goes through here, so
// no feature code ever builds a URL, handles a token, or parses an OData
// envelope itself.
//
// The double envelope is the easy thing to get wrong and is hidden entirely:
// callers name an entity set, not a URL. Everything below `read()` — which
// service owns the set, the CPI iFlow path, the APIPath/APIQuery pair, the
// OData v2 `{d:{results:[]}}` wrapper — is this file's problem.

import { SAP_CONTRACT } from "../contract/generated-contract"
import { loadCpiConfig, type CpiConfig } from "./config"
import { decodeRow, type SapRow } from "./decode-row"
import { AuthError, ContractError, NotFoundError, RequestError, TransientError } from "./errors"
import { TokenProvider } from "./token"

export interface CpiClientOptions {
  config?: CpiConfig
  fetchImpl?: typeof fetch
  tokenProvider?: TokenProvider
  /** Injected so tests do not actually wait. Defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>
  maxRetries?: number
}

export interface ReadOptions {
  /** OData query options, e.g. `$filter=... & $top=...`. Encoding is handled here. */
  query?: string
}

/**
 * A successful read. `status` is explicit so a caller cannot mistake "SAP has
 * no rows for this" for "the call failed" — two live sets still return zero
 * rows today (§1.3; a third, `ReservationItemSet`, was fixed 09-Sep 2026),
 * and the UI has to say so honestly rather than rendering a confident empty
 * list.
 */
export type ReadResult =
  | { status: "rows"; entitySet: string; query: string; rows: SapRow[]; unknownProperties: string[] }
  | { status: "empty"; entitySet: string; query: string; rows: []; unknownProperties: [] }

const DEFAULT_MAX_RETRIES = 3

export class CpiClient {
  private readonly config: CpiConfig
  private readonly fetchImpl: typeof fetch
  private readonly tokens: TokenProvider
  private readonly sleep: (ms: number) => Promise<void>
  private readonly maxRetries: number

  constructor(options: CpiClientOptions = {}) {
    this.config = options.config ?? loadCpiConfig()
    this.fetchImpl = options.fetchImpl ?? fetch
    this.tokens = options.tokenProvider ?? new TokenProvider(this.config, { fetchImpl: this.fetchImpl })
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  /** `sap/opu/odata/sap/<service>/<entitySet>` — the service comes from the contract, not the caller. */
  apiPathFor(entitySet: string, suffix = ""): string {
    const contract = SAP_CONTRACT[entitySet]
    if (!contract) {
      throw new ContractError(`No contract for entity set "${entitySet}". Run npm run contract:generate.`, {
        entitySet,
      })
    }
    return `sap/opu/odata/sap/${contract.service}/${entitySet}${suffix}`
  }

  /** Read rows from one entity set. */
  async read(entitySet: string, options: ReadOptions = {}): Promise<ReadResult> {
    const query = options.query ?? ""
    const response = await this.request(this.apiPathFor(entitySet), appendJsonFormat(query), entitySet)
    const text = await response.text()

    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      throw new ContractError(
        `${entitySet}: expected an OData JSON envelope, got ${text.slice(0, 120)}`,
        { entitySet, query }
      )
    }

    const results = extractResults(payload)
    if (results === null) {
      throw new ContractError(`${entitySet}: response had no d.results array`, { entitySet, query })
    }

    if (results.length === 0) {
      return { status: "empty", entitySet, query, rows: [], unknownProperties: [] }
    }

    const rows: SapRow[] = []
    const unknown = new Set<string>()
    for (const raw of results) {
      const decoded = decodeRow(entitySet, raw)
      rows.push(decoded.row)
      decoded.unknownProperties.forEach((p) => unknown.add(p))
    }

    return { status: "rows", entitySet, query, rows, unknownProperties: [...unknown] }
  }

  /**
   * `$count` for an entity set. Returns null when SAP cannot answer with a
   * 500 (§4) — currently no set is known to do this (both that used to,
   * `PurchaseRequisitionSet` and `GoodsMovementItemSet`, were fixed 09-Sep
   * 2026), but the null path stays live for whichever set breaks next.
   */
  async count(entitySet: string, options: ReadOptions = {}): Promise<number | null> {
    try {
      const response = await this.request(this.apiPathFor(entitySet, "/$count"), options.query ?? "", entitySet)
      const text = (await response.text()).trim()
      const parsed = Number(text)
      if (!Number.isInteger(parsed)) {
        throw new ContractError(`${entitySet}: $count returned ${JSON.stringify(text.slice(0, 60))}`, { entitySet })
      }
      return parsed
    } catch (error) {
      // A broken $count is a known, expected condition on two sets — the caller
      // demotes itself to fallback paging rather than failing the extraction.
      if (error instanceof TransientError) return null
      throw error
    }
  }

  /** Raw `$metadata` for a service. Used by the drift check and the smoke test. */
  async metadata(service: string): Promise<string> {
    // $metadata is EDMX, not JSON. Asking for JSON here earns an HTTP 406.
    const response = await this.request(`sap/opu/odata/sap/${service}/$metadata`, "", service, "application/xml")
    return response.text()
  }

  private async request(
    apiPath: string,
    apiQuery: string,
    entitySet: string,
    accept = "application/json"
  ): Promise<Response> {
    let refreshedOnce = false

    for (let attempt = 0; ; attempt++) {
      const token = await this.tokens.getToken()
      const url = this.buildUrl(apiPath, apiQuery)

      let response: Response
      try {
        response = await this.fetchImpl(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: accept },
        })
      } catch (cause) {
        if (attempt < this.maxRetries - 1) {
          await this.sleep(backoffMs(attempt))
          continue
        }
        throw new TransientError(`${entitySet}: network failure — ${(cause as Error).message}`, { entitySet })
      }

      if (response.ok) return response

      // One re-auth, once. A token can be revoked before its stated expiry.
      if (response.status === 401 && !refreshedOnce) {
        refreshedOnce = true
        this.tokens.invalidate()
        continue
      }

      if (response.status === 401 || response.status === 403) {
        throw new AuthError(`${entitySet}: HTTP ${response.status} after re-authenticating`, {
          entitySet,
          status: response.status,
        })
      }

      if (response.status === 404) {
        throw new NotFoundError(`${entitySet}: HTTP 404 for ${apiPath}`, { entitySet, status: 404 })
      }

      if (response.status >= 500) {
        if (attempt < this.maxRetries - 1) {
          await this.sleep(backoffMs(attempt))
          continue
        }
        throw new TransientError(`${entitySet}: HTTP ${response.status} after ${this.maxRetries} attempts`, {
          entitySet,
          status: response.status,
          query: apiQuery,
        })
      }

      // Any other 4xx: a bad request. Retrying an identical bad request is pointless.
      throw new RequestError(`${entitySet}: HTTP ${response.status}`, {
        entitySet,
        status: response.status,
        query: apiQuery,
      })
    }
  }

  /**
   * The double envelope, in one place. URLSearchParams encodes the OData query
   * wholesale, so filters containing spaces and quotes survive intact.
   */
  buildUrl(apiPath: string, apiQuery: string): string {
    const params = new URLSearchParams({ APIPath: apiPath, APIQuery: apiQuery })
    return `${this.config.baseUrl}${this.config.cpiPath}?${params.toString()}`
  }
}

function appendJsonFormat(query: string): string {
  if (query.includes("$format=")) return query
  return query ? `${query}&$format=json` : "$format=json"
}

function extractResults(payload: unknown): Record<string, unknown>[] | null {
  if (typeof payload !== "object" || payload === null) return null
  const d = (payload as { d?: unknown }).d
  if (typeof d !== "object" || d === null) return null
  const results = (d as { results?: unknown }).results
  if (Array.isArray(results)) return results as Record<string, unknown>[]
  // A single-entity read returns the entity directly under `d`, not in `results`.
  return [d as Record<string, unknown>]
}

/** 1s, 2s, 4s — matches cpi_discovery.py's proven behaviour against this endpoint. */
function backoffMs(attempt: number): number {
  return 2 ** attempt * 1000
}
