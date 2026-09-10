"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SharedRole } from "@/lib/shared-data/users"

export const ROLES: SharedRole[] = [
  "End User",
  "Engineering Manager",
  "Commercial Manager",
  "Warehouse Supervisor",
  "HOD",
  "Inventory Control",
  "Requester",
]

/**
 * Lets the viewer see Home's Priority Actions re-ranked the way each role
 * would naturally prioritize them (§6) — client-side re-sort over the same
 * underlying action list, never a different dataset or a separate app.
 */
export function RoleSwitcher({
  value,
  onChange,
}: {
  value: SharedRole
  onChange: (value: SharedRole) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SharedRole)}>
      <SelectTrigger size="sm" className="h-8 w-full sm:w-48">
        <SelectValue placeholder="Viewing as">
          {(v: string) => `Viewing as: ${v}`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {role}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
