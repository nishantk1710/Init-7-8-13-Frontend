import { MaterialName } from "@/components/shared/material-name"
import { StatusBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatQuantity } from "@/lib/assistant/session-view"
import { CLASSIFICATION_LABEL, type MaterialStock } from "@/lib/api/materials"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/** One page of materials: material, plant, OAR / Non-OAR, stock on hand. */
export function MaterialsTable({ rows }: { rows: MaterialStock[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead
              title="OAR by the same rule as the OAR Utilization pages: the MRP type SAP holds for the material at that plant. Everything else is Non-OAR."
            >
              Classification
            </TableHead>
            <TableHead
              className="text-right"
              title="Unrestricted stock (MARD-LABST) added up across the plant's storage locations. 0 when there is none, including a material with no storage location at the plant yet."
            >
              Stock on hand
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.material}|${row.plant}`}>
              <TableCell>
                <MaterialName material={row.material} description={row.materialDescription} className="max-w-[200px] xl:max-w-[360px]" />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{sapPlantLabel(row.plant)}</TableCell>
              <TableCell>
                {row.classification === "OAR" ? (
                  <StatusBadge>{CLASSIFICATION_LABEL.OAR}</StatusBadge>
                ) : (
                  <StatusBadge className="bg-muted text-muted-foreground">{CLASSIFICATION_LABEL.NON_OAR}</StatusBadge>
                )}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <span className="font-medium tabular-nums text-foreground">{formatQuantity(row.stockOnHand, "0")}</span>
                {row.unit && <span className="ml-1 text-xs text-muted-foreground">{row.unit}</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
