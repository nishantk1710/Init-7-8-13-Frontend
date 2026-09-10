"use client"

import { Fragment, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AuditEvent, InitiativeId } from "@/lib/domain/contracts"
import { downloadCsv } from "@/lib/utils"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { liveDecisionEvents, useInventoryWorkflow } from "@/features/initiative-7/context/workflow-context"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

const ALL_FILTER = "all"

// Product-facing names only, sourced from each module's manifest — never a
// hardcoded "Initiative N" label (see lib/material-router.ts for the same
// pattern).
const INITIATIVE_LABEL: Record<InitiativeId, string> = {
  "initiative-7": initiative7Manifest.name,
  "initiative-8": initiative8Manifest.name,
  "initiative-13": initiative13Manifest.name,
}

const INITIATIVES: InitiativeId[] = ["initiative-7", "initiative-8", "initiative-13"]

export function GlobalAuditLog({ events }: { events: AuditEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [initiative, setInitiative] = useState<InitiativeId | typeof ALL_FILTER>(ALL_FILTER)

  // Inventory Planning is the one module with live, in-session
  // decisions (send for approval / approve / adjust / reject — taken from
  // the Recommendations page, the Approvals workspace, or Action Center, all
  // sharing the one InventoryWorkflowProvider). Everything else here is the
  // static authored trail; this merges in what actually happened this session.
  const { states } = useInventoryWorkflow()
  const allEvents = useMemo(() => {
    // Timestamps are display-formatted strings ("18 Aug 2026 · 09:10 AM"),
    // not sortable ISO values, so this doesn't re-sort the whole list —
    // it puts this session's live actions first, newest last within that
    // group, ahead of the (already chronologically-authored) static trail.
    const live = RECOMMENDATIONS.flatMap((rec) => {
      const state = states[rec.id]
      return state ? liveDecisionEvents(rec, state) : []
    })
    return live.length === 0 ? events : [...live, ...events]
  }, [events, states])

  const filtered = useMemo(
    () => (initiative === ALL_FILTER ? allEvents : allEvents.filter((e) => e.initiative === initiative)),
    [allEvents, initiative]
  )

  function handleExport() {
    downloadCsv(
      "spares-ai-audit-trail.csv",
      ["Timestamp", "Initiative", "Entity", "Event type", "Actor", "Description"],
      filtered.map((e) => [
        e.timestamp,
        INITIATIVE_LABEL[e.initiative],
        e.entityId,
        e.eventType,
        e.actor ?? "System",
        e.description,
      ])
    )
    toast.success(`Exported ${filtered.length} audit events to CSV`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={initiative}
          onValueChange={(v) => setInitiative(v as InitiativeId | typeof ALL_FILTER)}
        >
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Initiative">
              {(value: string) =>
                value === ALL_FILTER ? "All initiatives" : INITIATIVE_LABEL[value as InitiativeId]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All initiatives</SelectItem>
            {INITIATIVES.map((id) => (
              <SelectItem key={id} value={id}>
                {INITIATIVE_LABEL[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5" />
          Export to CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Timestamp</TableHead>
            <TableHead>Initiative</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Event type</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((event) => {
            const isExpanded = expandedId === event.id
            return (
              <Fragment key={event.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  aria-expanded={isExpanded}
                >
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{event.timestamp}</TableCell>
                  <TableCell className="text-foreground">
                    {INITIATIVE_LABEL[event.initiative]}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{event.entityId}</TableCell>
                  <TableCell className="text-foreground">{event.eventType}</TableCell>
                  <TableCell className="text-muted-foreground">{event.actor ?? "System"}</TableCell>
                  <TableCell className="max-w-[320px] truncate text-muted-foreground">
                    {event.description}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell />
                    <TableCell
                      colSpan={6}
                      className="bg-muted/30 py-3 text-xs whitespace-normal text-foreground"
                    >
                      {event.description}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
