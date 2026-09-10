// W2.6a — per-set routing (§7.4).
//
// This is what turns go-live from a cutover into a dial. Every entity set is
// independently either `mock` (served by the fake gateway from synthetic CSVs)
// or `live` (served by real CPI). Flipping one set is a config edit, and a set
// pointed at an unreachable live endpoint fails ONLY that set.
//
// It is also what makes §1.3 survivable: schema is real for all 21 sets, but
// the three that return zero rows can stay on `mock` for data while everything
// else goes live.

import type { CpiClient, ReadOptions, ReadResult } from "./client/client"

export type SetSource = "mock" | "live"

/** Applied to any set not named in SET_SOURCES. */
export const DEFAULT_SOURCE: SetSource = "mock"

/**
 * Per-set overrides. Today every set is mock, because the app has never read
 * a real SAP row. Flip sets to "live" one at a time, each followed by the
 * smoke test.
 *
 * Note the three sets in EMPTY_SETS should be the LAST to flip: their schema
 * is live but they hold no rows, so flipping them early replaces working
 * synthetic data with a legitimately empty screen.
 */
export const SET_SOURCES: Record<string, SetSource> = {}

export function sourceFor(entitySet: string, sources: Record<string, SetSource> = SET_SOURCES): SetSource {
  return sources[entitySet] ?? DEFAULT_SOURCE
}

/** A read result that knows whether it came from real SAP or from fixtures. */
export type RoutedReadResult = ReadResult & { source: SetSource; synthetic: boolean }

export interface SapRouterOptions {
  live: CpiClient
  mock: CpiClient
  sources?: Record<string, SetSource>
}

export class SapRouter {
  private readonly sources: Record<string, SetSource>

  constructor(private readonly options: SapRouterOptions) {
    this.sources = options.sources ?? SET_SOURCES
  }

  clientFor(entitySet: string): CpiClient {
    return sourceFor(entitySet, this.sources) === "live" ? this.options.live : this.options.mock
  }

  /**
   * Read through whichever source this set is routed to, tagging the result so
   * the UI can show its "synthetic data" banner (§7.6). With schema now real
   * but reservation data empty, the risk of demoing synthetic numbers as real
   * has gone up, not down.
   */
  async read(entitySet: string, options: ReadOptions = {}): Promise<RoutedReadResult> {
    const source = sourceFor(entitySet, this.sources)
    const result = await this.clientFor(entitySet).read(entitySet, options)
    return { ...result, source, synthetic: source === "mock" }
  }

  async count(entitySet: string, options: ReadOptions = {}): Promise<number | null> {
    return this.clientFor(entitySet).count(entitySet, options)
  }

  /** Which sets are currently served from fixtures — drives the banner and the readiness table. */
  syntheticSets(entitySets: string[]): string[] {
    return entitySets.filter((entitySet) => sourceFor(entitySet, this.sources) === "mock")
  }
}
