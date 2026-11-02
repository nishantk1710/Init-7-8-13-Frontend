"use client"

import { useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { downloadRequestTemplate, uploadErrors, uploadRequestFile } from "@/lib/api/assistant-requests"
import { checkAgainstRequest, type UploadContext, type UploadPlan } from "@/lib/assistant/request/upload"
import { sapPlantName } from "@/lib/shared-data/sap-plants"

type State =
  | { step: "idle" }
  | { step: "reading"; fileName: string }
  | { step: "refused"; fileName: string; errors: string[] }
  | { step: "ready"; fileName: string; plan: UploadPlan }

/**
 * "Upload Excel": the request's materials from the template. The backend reads
 * and checks the file (`POST /assistant/requests/upload`) and stores nothing;
 * once the requester confirms, each material is previewed as if added by hand.
 */
export function UploadMaterials({
  context,
  disabled,
  onConfirm,
}: {
  context: UploadContext
  disabled?: boolean
  onConfirm: (plan: UploadPlan) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ step: "idle" })
  const open = state.step !== "idle"

  async function read(file: File) {
    setState({ step: "reading", fileName: file.name })
    try {
      const check = checkAgainstRequest(await uploadRequestFile(file), context)
      setState(
        check.ok
          ? { step: "ready", fileName: file.name, plan: check }
          : { step: "refused", fileName: file.name, errors: check.errors }
      )
    } catch (error) {
      setState({
        step: "refused",
        fileName: file.name,
        errors: uploadErrors(error) ?? [
          `The file could not be checked. ${error instanceof Error ? error.message : "The backend did not answer."}`,
        ],
      })
    }
  }

  function close() {
    setState({ step: "idle" })
    if (input.current) input.current.value = ""
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
          <Upload /> Upload Excel
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void downloadTemplate()}>
          <Download /> Download Excel format
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Fill in the format: Material, Plant, Department. One plant and one department, up to {context.maxLines}{" "}
          materials.
        </span>
        <input
          ref={input}
          type="file"
          accept=".xlsx"
          className="hidden"
          aria-label="Upload materials file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void read(file)
          }}
        />
      </div>

      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-4" /> Upload materials
            </DialogTitle>
            {state.step !== "idle" && (
              <DialogDescription className="truncate font-mono text-xs">{state.fileName}</DialogDescription>
            )}
          </DialogHeader>

          {state.step === "reading" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Checking the file…
            </p>
          )}

          {state.step === "refused" && (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="size-4" /> Nothing was added. Fix the file and upload it again.
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {state.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {state.step === "ready" && <Summary plan={state.plan} />}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              {state.step === "ready" ? "Cancel" : "Close"}
            </Button>
            {state.step === "refused" && (
              <Button type="button" variant="outline" onClick={() => input.current?.click()}>
                <Upload /> Choose another file
              </Button>
            )}
            {state.step === "ready" && (
              <Button
                type="button"
                onClick={() => {
                  onConfirm(state.plan)
                  close()
                }}
              >
                Add {state.plan.materials.length} material{state.plan.materials.length === 1 ? "" : "s"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

async function downloadTemplate() {
  try {
    await downloadRequestTemplate()
  } catch (error) {
    toast.error("Could not download the Excel format", {
      description: error instanceof Error ? error.message : "The backend did not answer.",
    })
  }
}

function Summary({ plan }: { plan: UploadPlan }) {
  const plantName = sapPlantName(plan.plant)
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-success" /> {plan.materials.length} material
        {plan.materials.length === 1 ? "" : "s"} ready to add
      </p>
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Plant</dt>
        <dd>
          <span className="font-mono font-semibold">{plan.plant}</span> {plantName}
        </dd>
        <dt className="text-muted-foreground">Department</dt>
        <dd>
          <span className="font-mono font-semibold">{plan.department}</span> {plan.departmentName}
        </dd>
        <dt className="text-muted-foreground">Rows read</dt>
        <dd>{plan.rowCount}</dd>
      </dl>
      {(plan.duplicates.length > 0 || plan.alreadyAdded.length > 0) && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {plan.duplicates.length > 0 && (
            <li>
              {plan.duplicates.length} duplicate{plan.duplicates.length === 1 ? "" : "s"} merged:{" "}
              <span className="font-mono">{plan.duplicates.join(", ")}</span>
            </li>
          )}
          {plan.alreadyAdded.length > 0 && (
            <li>
              Already on this request, skipped: <span className="font-mono">{plan.alreadyAdded.join(", ")}</span>
            </li>
          )}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        The plant and department are set from the file. Each material is then checked and goes to its table; you
        answer the quantity and reasons on screen as usual.
      </p>
    </div>
  )
}
