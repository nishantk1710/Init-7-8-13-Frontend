"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, Loader2, Printer, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { OAR_PLANTS } from "@/features/initiative-13/utils/filter-options"
import { fetchSummaryReportWorkbook, generateSummaryReport } from "@/lib/api/i13-report"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

// Not exported: a constant exported from a "use client" module reaches a
// server component as a client reference, not as the string.
const REPORT_PATH = "/oar-utilization/report"

/**
 * Generate a new report, and download the one on screen.
 *
 * Generating is a POST that saves a row, so the button locks while it runs and
 * nothing retries it (see `apiPost`). It takes as long as the AI provider does
 * — usually well under a minute — and the button says so rather than looking
 * frozen. On success the page navigates to the new report.
 */
export function SummaryReportActions({ reportId }: { reportId: string | null }) {
  const router = useRouter()
  const [plant, setPlant] = useState("")
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function generate() {
    setGenerating(true)
    try {
      const report = await generateSummaryReport(plant || undefined)
      toast.success(
        report.narrativeSource === "MODEL" ? "Report generated." : "Report generated with standard wording."
      )
      router.push(`${REPORT_PATH}?id=${encodeURIComponent(report.id)}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The report could not be generated.")
    } finally {
      setGenerating(false)
    }
  }

  async function downloadExcel() {
    if (!reportId) return
    setExporting(true)
    try {
      const { blobUrl, filename } = await fetchSummaryReportWorkbook(reportId)
      const anchor = document.createElement("a")
      anchor.href = blobUrl
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workbook could not be downloaded.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Plant"
        value={plant}
        onChange={(event) => setPlant(event.target.value)}
        disabled={generating}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
      >
        <option value="">All plants</option>
        {OAR_PLANTS.map((code) => (
          <option key={code} value={code}>
            {sapPlantLabel(code)}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={generate} disabled={generating}>
        {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {generating ? "Generating… up to a minute" : "Generate report"}
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()} disabled={!reportId || generating}>
        <Printer className="size-3.5" />
        Download PDF
      </Button>
      <Button size="sm" variant="outline" onClick={downloadExcel} disabled={!reportId || exporting || generating}>
        {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
        Download Excel
      </Button>
    </div>
  )
}
