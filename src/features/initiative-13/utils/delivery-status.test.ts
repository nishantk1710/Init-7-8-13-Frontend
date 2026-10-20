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
      expectedDate: null,
      overdue: false,
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
      expectedDate: null,
      overdue: false,
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

describe("expected delivery (EKET-EINDT)", () => {
  const TODAY = "2026-10-21"

  it("a line not delivered carries its expected date", () => {
    const status = deliveryStatus({ ...base, receivedQuantity: 0, expectedDeliveryDate: "2026-10-25" }, TODAY)
    expect(status).toMatchObject({ state: "NOT_DELIVERED", expectedDate: "2026-10-25", overdue: false })
  })

  it("is overdue once the expected date has passed", () => {
    const status = deliveryStatus({ ...base, receivedQuantity: 0, expectedDeliveryDate: "2026-10-12" }, TODAY)
    expect(status).toMatchObject({ expectedDate: "2026-10-12", overdue: true })
  })

  it("due today is not overdue yet", () => {
    const status = deliveryStatus({ ...base, receivedQuantity: 0, expectedDeliveryDate: TODAY }, TODAY)
    expect(status.overdue).toBe(false)
  })

  it("a partial delivery carries the next expected date for the rest", () => {
    const status = deliveryStatus({ ...base, receivedQuantity: 5, expectedDeliveryDate: "2026-11-05" }, TODAY)
    expect(status).toMatchObject({ state: "PARTIAL", date: "2026-10-10", expectedDate: "2026-11-05", overdue: false })
  })

  it("a delivered line never shows an expected date or overdue", () => {
    const status = deliveryStatus({ ...base, expectedDeliveryDate: "2026-10-01" }, TODAY)
    expect(status).toMatchObject({ state: "DELIVERED", expectedDate: null, overdue: false })
  })

  it("no EKET row: no expected date, not overdue", () => {
    const status = deliveryStatus({ ...base, receivedQuantity: 0, expectedDeliveryDate: null }, TODAY)
    expect(status).toMatchObject({ expectedDate: null, overdue: false })
  })

  it("the lines view follows the same rule", () => {
    const line = { hasPo: true, firstGrDate: null, latestGrDate: null, expectedDeliveryDate: "2026-10-12" }
    expect(deliveryStatusFromProcurement({ ...line, procurementStatus: "OPEN" }, TODAY)).toMatchObject({
      state: "NOT_DELIVERED",
      expectedDate: "2026-10-12",
      overdue: true,
    })
    expect(deliveryStatusFromProcurement({ ...line, procurementStatus: "RECEIVED" }, TODAY)).toMatchObject({
      expectedDate: null,
      overdue: false,
    })
    expect(
      deliveryStatusFromProcurement({ ...line, hasPo: false, procurementStatus: "OPEN" }, TODAY)
    ).toMatchObject({ state: "NO_PO", expectedDate: null })
  })
})
