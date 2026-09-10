import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { GlobalAction } from "@/lib/domain/contracts"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

const MODULE_LABEL: Record<GlobalAction["initiative"], string> = {
  "initiative-7": initiative7Manifest.name,
  "initiative-8": initiative8Manifest.name,
  "initiative-13": initiative13Manifest.name,
}

const SEVERITY_TONE = {
  critical: "danger",
  warning: "warning",
  info: "default",
} as const

/** The §26 approvals table — Material / Decision Needed / Type — a
 * different presentation of the same shared action feed, not a fork. */
export function ApprovalsTable({ approvals }: { approvals: GlobalAction[] }) {
  if (approvals.length === 0) {
    return <EmptyState title="You're up to date — nothing is waiting on your decision." />
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Decision needed</TableHead>
            <TableHead className="w-[160px]">Module</TableHead>
            <TableHead className="w-[100px]">Priority</TableHead>
            <TableHead className="w-[100px]">Raised</TableHead>
            <TableHead className="w-[84px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {approvals.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="text-foreground">{a.title}</TableCell>
              <TableCell className="text-muted-foreground">{MODULE_LABEL[a.initiative]}</TableCell>
              <TableCell>
                <StatusBadge tone={SEVERITY_TONE[a.severity]}>{a.severity}</StatusBadge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{a.createdAt}</TableCell>
              <TableCell>
                <Link
                  href={a.href}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                >
                  Review
                  <ArrowRight className="size-3" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
