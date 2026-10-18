"use client"

import { useEffect, useState } from "react"

import { getPlantById } from "@/lib/shared-data/plants"
import { formatCount } from "@/lib/utils"
import { fetchSimilarMaterials, type SimilarMaterial } from "@/features/initiative-7/services/i7-api"

type State = { status: "loading" } | { status: "error" } | { status: "ready"; items: SimilarMaterial[] }

function percent(similarity: number | null): string {
  return similarity === null ? "—" : `${Math.round(similarity * 100)}%`
}

function stock(value: number | null): string {
  return value === null ? "—" : formatCount(value)
}

/** The materials an OAR (cold-start) recommendation was sized from (the backend
 * keeps up to five), best match first, read verbatim from the stored similarity
 * result. Shown beside the usage chart because a cold-start material has no usage
 * of its own to explain its numbers -- these neighbours are the evidence instead. */
export function SimilarMaterialsList({ recommendationId }: { recommendationId: string }) {
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    fetchSimilarMaterials(recommendationId)
      .then((items) => {
        if (!cancelled) setState({ status: "ready", items })
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" })
      })
    return () => {
      cancelled = true
    }
  }, [recommendationId])

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h4 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {state.status === "ready" && state.items.length > 0
          ? `${state.items.length} similar ${state.items.length === 1 ? "material" : "materials"} used`
          : "Similar materials"}
      </h4>
      <p className="mt-1 text-[11px] text-muted-foreground">
        The recommended reorder point, safety stock and max stock are an average of these materials&apos; current SAP
        values, giving more weight to the closer matches. Best match first.
      </p>

      {state.status === "loading" && <p className="mt-3 text-xs text-muted-foreground">Loading similar materials…</p>}
      {state.status === "error" && (
        <p className="mt-3 text-xs text-muted-foreground">Similar materials could not be loaded. Try again shortly.</p>
      )}
      {state.status === "ready" && state.items.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          No similar materials were recorded for this material, so its numbers were not sized from similarity.
        </p>
      )}
      {state.status === "ready" && state.items.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 pr-2 font-medium">#</th>
                <th className="py-1.5 pr-2 font-medium">Material</th>
                <th className="py-1.5 pr-2 font-medium">Plant</th>
                <th className="py-1.5 pr-2 text-right font-medium">Match</th>
                <th className="py-1.5 pr-2 text-right font-medium">Current ROP</th>
                <th className="py-1.5 pr-2 text-right font-medium">Current Safety</th>
                <th className="py-1.5 text-right font-medium">Current Max</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={`${item.material}-${item.plant}`} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 pr-2 text-muted-foreground tabular-nums">{item.rank}</td>
                  <td className="py-1.5 pr-2">
                    <div className="font-medium text-foreground">{item.description ?? item.material}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.material}
                      {item.criticality ? ` · ${item.criticality}` : ""}
                      {item.contributed ? "" : " · not used in estimate"}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{getPlantById(item.plant)?.name ?? item.plant}</td>
                  <td className="py-1.5 pr-2 text-right font-medium tabular-nums">{percent(item.similarity)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{stock(item.rop)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{stock(item.safetyStock)}</td>
                  <td className="py-1.5 text-right tabular-nums">{stock(item.maxStock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
