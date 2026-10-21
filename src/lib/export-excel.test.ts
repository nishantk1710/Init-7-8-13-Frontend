import ExcelJS from "exceljs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

import { downloadExcel } from "./export-excel"

// Node has no DOM: capture the Blob handed to createObjectURL and the name the
// anchor would have downloaded it under.
let captured: { blob?: Blob; filename?: string }

beforeEach(() => {
  captured = {}
  const link = {
    href: "",
    download: "",
    click: () => {
      captured.filename = link.download
    },
  }
  vi.stubGlobal("document", {
    createElement: () => link,
    body: { appendChild: () => {}, removeChild: () => {} },
  })
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    captured.blob = blob as Blob
    return "blob:test"
  })
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function readBack(): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await captured.blob!.arrayBuffer())
  return workbook.worksheets[0]
}

describe("downloadExcel", () => {
  it("writes a workbook with a bold, frozen, filterable header row", async () => {
    const ok = await downloadExcel("sessions.xlsx", ["Reference", "Turns"], [["AB12CD34EF", 3]])

    expect(ok).toBe(true)
    expect(captured.filename).toBe("sessions.xlsx")
    expect(captured.blob?.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    const sheet = await readBack()
    expect(sheet.getRow(1).values).toEqual([undefined, "Reference", "Turns"])
    expect(sheet.getRow(1).font?.bold).toBe(true)
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 })
    expect(sheet.autoFilter).toBeTruthy()
  })

  it("keeps material numbers as text, numbers as numbers, ISO dates as dates", async () => {
    await downloadExcel(
      "x.xlsx",
      ["Material", "Qty", "Required", "Issued", "Note"],
      [["000000000010001234", 12.5, "2026-10-14", "2026-10-14T08:30:00Z", ""]]
    )

    const row = (await readBack()).getRow(2)
    expect(row.getCell(1).value).toBe("000000000010001234")
    expect(row.getCell(2).value).toBe(12.5)
    expect(row.getCell(3).value).toEqual(new Date("2026-10-14T00:00:00Z"))
    expect(row.getCell(4).value).toEqual(new Date("2026-10-14T08:30:00Z"))
    expect(row.getCell(5).value).toBeNull()
  })
})
