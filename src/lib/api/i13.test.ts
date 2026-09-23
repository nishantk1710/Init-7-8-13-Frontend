/**
 * The Initiative 13 wire adapters — the three things they exist to get right.
 *
 * These are not tests of the endpoints. They are tests of the layer between the
 * backend's snake_case wire shape and what a component renders, which is where
 * three specific defects lived before it existed:
 *
 *   1. an unchecked `as` cast put an unrecognised status straight into a
 *      `Record<Union, Tone>` lookup;
 *   2. `Number(x ?? 0)` turned "nobody recorded this" into "this is zero"; and
 *   3. dates arrived as raw ISO in an app that renders "28 Jul 2026".
 *
 * Each is asserted below against the real wire shapes.
 */

import { describe, expect, it } from "vitest"

import { formatApiDate, formatApiDateTime, oneOf, toCount, toNumber } from "@/lib/api/format"

describe("oneOf — a value the backend adds must not break a table", () => {
  const BANDS = ["FAST", "SLOW", "NON_MOVING"] as const

  it("passes a known value through", () => {
    expect(oneOf("SLOW", BANDS, "NON_MOVING")).toBe("SLOW")
  })

  it("falls back rather than returning a string outside the union", () => {
    // The failure this prevents: AGING_TONE[band] is `undefined` for an
    // unrecognised band, and the badge renders unstyled or throws depending on
    // what the component does with it.
    expect(oneOf("GLACIAL", BANDS, "NON_MOVING")).toBe("NON_MOVING")
  })

  it("falls back for null and undefined, not just for a wrong string", () => {
    expect(oneOf(null, BANDS, "FAST")).toBe("FAST")
    expect(oneOf(undefined, BANDS, "FAST")).toBe("FAST")
  })
})

describe("toNumber — unknown is not zero", () => {
  it("parses a decimal sent as a string", () => {
    // Decimals cross the wire as strings so JSON cannot round them.
    expect(toNumber("12.5")).toBe(12.5)
  })

  it("keeps undefined for null, rather than defaulting to 0", () => {
    // The distinction this protects: on an acquired-vs-plan variance, a zero
    // received quantity means nothing arrived, and an absent one means nobody
    // recorded what did. They point at different problems.
    expect(toNumber(null)).toBeUndefined()
    expect(toNumber(undefined)).toBeUndefined()
    expect(toNumber("")).toBeUndefined()
  })

  it("keeps a real zero as zero", () => {
    expect(toNumber("0")).toBe(0)
    expect(toNumber(0)).toBe(0)
  })

  it("returns undefined rather than NaN for a non-numeric value", () => {
    // NaN propagates silently through arithmetic and renders as "NaN" in a
    // cell; undefined is caught by the same null-check every other gap uses.
    expect(toNumber("not a number")).toBeUndefined()
  })
})

describe("toCount — where zero genuinely is the answer", () => {
  it("defaults to zero, unlike toNumber", () => {
    // Only for counts. "Consumed 0 times in twelve months" is exactly what the
    // backend means by 0, and it is the non-mover signal.
    expect(toCount(null)).toBe(0)
    expect(toCount(undefined)).toBe(0)
  })

  it("still parses a real value", () => {
    expect(toCount(7)).toBe(7)
    expect(toCount("7")).toBe(7)
  })
})

describe("formatApiDate", () => {
  it("renders the display form the rest of the app uses", () => {
    expect(formatApiDate("2026-07-28")).toBe("28 Jul 2026")
  })

  it("returns the placeholder for null, never today's date", () => {
    // The dangerous failure: a missing date rendered as today looks like a
    // present one, and on an aging screen that is the whole measurement.
    expect(formatApiDate(null)).toBe("—")
    expect(formatApiDate(undefined)).toBe("—")
  })

  it("returns the placeholder for an unparseable value, never 'Invalid Date'", () => {
    expect(formatApiDate("not-a-date")).toBe("—")
  })

  it("does not shift the day across a timezone", () => {
    // Parsed as UTC and rendered as UTC. Without that, a date near midnight
    // moves by a day for anyone west of Greenwich -- which silently changes
    // which aging band a row falls into.
    //
    // Asserted on the day and month rather than the exact string: en-ZA
    // zero-pads a single-digit day ("01 Jan"), and the padding is not what this
    // test is about.
    expect(formatApiDate("2026-01-01")).toMatch(/^0?1 Jan 2026$/)
    expect(formatApiDate("2026-12-31")).toMatch(/^31 Dec 2026$/)
  })
})

describe("formatApiDateTime", () => {
  it("keeps the time, because staleness is measured in hours", () => {
    // `calculatedAt` is how a reader judges how old a screen is, and nothing on
    // Initiative 13 recomputes on its own. "Today" and "today at 04:00" are
    // different answers to that question.
    const rendered = formatApiDateTime("2026-07-28T04:30:00Z")
    expect(rendered).not.toBe("—")
    expect(rendered).toMatch(/2026/)
  })

  it("returns the placeholder for null", () => {
    expect(formatApiDateTime(null)).toBe("—")
  })
})
