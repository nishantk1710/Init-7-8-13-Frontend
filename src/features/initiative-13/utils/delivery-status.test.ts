import { describe, expect, it } from "vitest"

import { DELIVERY_STATE_LABELS, deliveryStatus, deliveryStatusFromProcurement } from "./delivery-status"

const base = {
  hasPo: true,
  receivedQuantity: 10,
  orderedQuantity: 10,
  firstGrDate: "2026-10-03",
  latestGrDate: "2026-10-10",
}

describe("deliveryStatus", () => {
  it("fully received shows the latest receipt date as delivered", () => {
    expect(deliveryStatus(base)).toEqual({
      state: "DELIVERED",
      date: "2026-10-10",
      firstDate: "2026-10-03",
    })
  })

  it("less than ordered is partial, never delivered", () => {
    expect(deliveryStatus({ ...base, receivedQuantity: 5 })).toMatchObject({
      state: "PARTIAL",
      date: "2026-10-10",
    })
  })

  it("a fully reversed receipt has a date but reads not delivered", () => {
    expect(deliveryStatus({ ...base, receivedQuantity: 0 })).toEqual({
      state: "NOT_DELIVERED",
      date: null,
      firstDate: null,
    })
  })

  it("nothing received is not delivered", () => {
    expect(
      deliveryStatus({ ...base, receivedQuantity: null, firstGrDate: null, latestGrDate: null })
    ).toMatchObject({ state: "NOT_DELIVERED" })
  })

  it("an unknown ordered quantity cannot make a receipt partial", () => {
    expect(deliveryStatus({ ...base, orderedQuantity: null, receivedQuantity: 3 })).toMatchObject({
      state: "DELIVERED",
    })
  })

  it("no PO yet has no delivery", () => {
    expect(deliveryStatus({ ...base, hasPo: false })).toMatchObject({ state: "NO_PO", date: null })
  })

  it("falls back to the one date it has", () => {
    expect(deliveryStatus({ ...base, latestGrDate: null })).toMatchObject({ date: "2026-10-03" })
  })
})

describe("deliveryStatusFromProcurement", () => {
  const line = { hasPo: true, firstGrDate: "2026-10-03", latestGrDate: "2026-10-10" }

  it("maps the backend procurement status", () => {
    expect(deliveryStatusFromProcurement({ ...line, procurementStatus: "RECEIVED" })).toMatchObject({
      state: "DELIVERED",
      date: "2026-10-10",
    })
    expect(
      deliveryStatusFromProcurement({ ...line, procurementStatus: "PARTIALLY_RECEIVED" })
    ).toMatchObject({ state: "PARTIAL", date: "2026-10-10" })
    expect(deliveryStatusFromProcurement({ ...line, procurementStatus: "OPEN" })).toMatchObject({
      state: "NOT_DELIVERED",
      date: null,
    })
  })

  it("a PR-only line has no delivery", () => {
    expect(
      deliveryStatusFromProcurement({ ...line, hasPo: false, procurementStatus: "OPEN" })
    ).toMatchObject({ state: "NO_PO" })
  })
})

describe("DELIVERY_STATE_LABELS", () => {
  it("labels every state", () => {
    expect(Object.keys(DELIVERY_STATE_LABELS).sort()).toEqual(["DELIVERED", "NOT_DELIVERED", "NO_PO", "PARTIAL"])
  })
})
