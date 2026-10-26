"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/client"
import { isPlaceholderActor } from "@/lib/api/actor"
import { sapPlantName } from "@/lib/shared-data/sap-plants"
import { formatCount } from "@/lib/utils"
import {
  excludeSimilarMaterial,
  fetchSimilarMaterialsView,
  restoreSimilarMaterial,
  type ExcludedSimilarMaterial,
  type SimilarMaterial,
  type SimilarMaterialsView,
} from "@/features/initiative-7/services/i7-api"

type State = { status: "loading" } | { status: "error" } | { status: "ready"; view: SimilarMaterialsView }

function percent(similarity: number | null): string {
  return similarity === null ? "—" : `${Math.round(similarity * 100)}%`
}

function stock(value: number | null): string {
  return value === null ? "—" : formatCount(value)
}

const keyOf = (item: { material: string; plant: string }) => `${item.material}-${item.plant}`

/** Who removed it, without presenting a placeholder identity as a signed-in person. */
function whoRemoved(excludedBy: string): string {
  return isPlaceholderActor(excludedBy) ? `${excludedBy} (not signed in)` : excludedBy
}

function removedOn(excludedAt: string | null): string | null {
  if (!excludedAt) return null
  const date = new Date(excludedAt)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString()
}

/** A sentence for the person looking at the screen: the backend's own reason when it gave one (a refused
 * removal says why -- past review, too few left), otherwise a plain failure message. */
export function changeErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.detail) {
    return error.detailText()
  }
  return "That change could not be saved. Nothing was changed. Try again shortly."
}

export interface SimilarMaterialsCardProps {
  state: State
  /** The similar material whose removal is being confirmed, if any. */
  confirming: SimilarMaterial | null
  reason: string
  /** Key of the request in flight; every control is disabled while one is. */
  busy: string | null
  actionError: string | null
  onAskRemove: (item: SimilarMaterial) => void
  onCancel: () => void
  onReasonChange: (reason: string) => void
  onConfirmRemove: (item: SimilarMaterial) => void
  onRestore: (item: ExcludedSimilarMaterial) => void
}

/** The materials an OAR (cold-start) recommendation was sized from, best match first, read verbatim from the
 * stored similarity result -- and, below, the ones a person removed for this material. Shown beside the usage
 * chart because a cold-start material has no usage of its own to explain its numbers; these are the evidence
 * instead. Presentational: `SimilarMaterialsList` owns the state. */
export function SimilarMaterialsCard({
  state,
  confirming,
  reason,
  busy,
  actionError,
  onAskRemove,
  onCancel,
  onReasonChange,
  onConfirmRemove,
  onRestore,
}: SimilarMaterialsCardProps) {
  const reasonId = useId()
  const view = state.status === "ready" ? state.view : null
  const items = view?.items ?? []
  const excluded = view?.excluded ?? []
  const editable = view?.canEdit === true
  const disabled = busy !== null

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h4 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {items.length > 0
          ? `${items.length} similar ${items.length === 1 ? "material" : "materials"} used`
          : "Similar materials"}
      </h4>
      <p className="mt-1 text-[11px] text-muted-foreground">
        The recommended reorder point, safety stock and max stock are an average of these materials&apos; current SAP
        values, giving more weight to the closer matches. Best match first.
        {editable && " Remove one that is not a fair comparison — it is left out for this material only."}
      </p>

      {state.status === "loading" && <p className="mt-3 text-xs text-muted-foreground">Loading similar materials…</p>}
      {state.status === "error" && (
        <p className="mt-3 text-xs text-muted-foreground">Similar materials could not be loaded. Try again shortly.</p>
      )}
      {view && items.length === 0 && excluded.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          No similar materials were recorded for this material, so its numbers were not sized from similarity.
        </p>
      )}

      {actionError && (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          {actionError}
        </p>
      )}

      {view && items.length > 0 && (
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
                {editable && <th className="py-1.5 pl-2 text-right font-medium">Action</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isConfirming = confirming !== null && keyOf(confirming) === keyOf(item)
                return (
                  <SimilarRow
                    key={keyOf(item)}
                    item={item}
                    editable={editable}
                    disabled={disabled}
                    isConfirming={isConfirming}
                    busy={busy === keyOf(item)}
                    reason={reason}
                    reasonId={reasonId}
                    onAskRemove={onAskRemove}
                    onCancel={onCancel}
                    onReasonChange={onReasonChange}
                    onConfirmRemove={onConfirmRemove}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {view && editable && view.minimumNeighbours !== null && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          At least {view.minimumNeighbours} similar materials are needed to size this recommendation. A removal that
          would leave fewer is refused and nothing changes.
        </p>
      )}
      {view && view.canEdit === false && view.editBlockedReason && (items.length > 0 || excluded.length > 0) && (
        <p className="mt-2 text-[11px] text-muted-foreground">{view.editBlockedReason}</p>
      )}

      {excluded.length > 0 && (
        <div className="mt-3 border-t border-border pt-2.5">
          <h5 className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Removed for this material ({excluded.length})
          </h5>
          <ul className="mt-1.5 flex flex-col gap-2">
            {excluded.map((entry) => {
              const date = removedOn(entry.excludedAt)
              return (
                <li key={keyOf(entry)} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground">{entry.description ?? entry.material}</span>
                      <StatusBadge tone="warning">Removed by a user</StatusBadge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {entry.material} · {sapPlantName(entry.plant)}
                      {entry.similarity !== null ? ` · was a ${percent(entry.similarity)} match` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Removed by {whoRemoved(entry.excludedBy)}
                      {date ? ` on ${date}` : ""}
                      {entry.reason ? ` — “${entry.reason}”` : ""}
                    </div>
                  </div>
                  {editable && (
                    <Button size="xs" variant="outline" disabled={disabled} onClick={() => onRestore(entry)}>
                      {busy === keyOf(entry) ? "Restoring…" : "Restore"}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function SimilarRow({
  item,
  editable,
  disabled,
  isConfirming,
  busy,
  reason,
  reasonId,
  onAskRemove,
  onCancel,
  onReasonChange,
  onConfirmRemove,
}: {
  item: SimilarMaterial
  editable: boolean
  disabled: boolean
  isConfirming: boolean
  busy: boolean
  reason: string
  reasonId: string
  onAskRemove: (item: SimilarMaterial) => void
  onCancel: () => void
  onReasonChange: (reason: string) => void
  onConfirmRemove: (item: SimilarMaterial) => void
}) {
  return (
    <>
      <tr className="border-b border-border/60 last:border-0">
        <td className="py-1.5 pr-2 text-muted-foreground tabular-nums">{item.rank}</td>
        <td className="py-1.5 pr-2">
          <div className="font-medium text-foreground">{item.description ?? item.material}</div>
          <div className="text-[11px] text-muted-foreground">
            {item.material}
            {item.criticality ? ` · ${item.criticality}` : ""}
            {item.contributed ? "" : " · not used in estimate"}
          </div>
        </td>
        <td className="py-1.5 pr-2 text-muted-foreground">{sapPlantName(item.plant)}</td>
        <td className="py-1.5 pr-2 text-right font-medium tabular-nums">{percent(item.similarity)}</td>
        <td className="py-1.5 pr-2 text-right tabular-nums">{stock(item.rop)}</td>
        <td className="py-1.5 pr-2 text-right tabular-nums">{stock(item.safetyStock)}</td>
        <td className="py-1.5 text-right tabular-nums">{stock(item.maxStock)}</td>
        {editable && (
          <td className="py-1.5 pl-2 text-right">
            <Button
              size="xs"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              disabled={disabled}
              onClick={() => onAskRemove(item)}
            >
              Remove
            </Button>
          </td>
        )}
      </tr>
      {isConfirming && (
        <tr className="border-b border-border/60">
          <td colSpan={editable ? 8 : 7} className="pb-2.5">
            <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2.5">
              <p className="text-xs text-foreground">
                Remove <span className="font-medium">{item.description ?? item.material}</span>{" "}
                from this material&apos;s similar materials? Nothing takes its place: the recommended figures are
                recalculated from the ones that remain. Other materials are not affected.
              </p>
              <label htmlFor={reasonId} className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
                Reason (optional)
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                rows={2}
                maxLength={500}
                disabled={disabled}
                placeholder="Why it is not a fair comparison -- kept with the removal…"
                className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={disabled}
                  onClick={() => onConfirmRemove(item)}
                >
                  {busy ? "Removing…" : "Confirm remove"}
                </Button>
                <Button size="sm" variant="ghost" disabled={disabled} onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** The similar-materials card for one recommendation. `onChanged` is called after a removal or restore has been
 * saved, so the parent can re-read the recommendation and every figure it shows (reorder point, safety stock,
 * max stock) moves with it. */
export function SimilarMaterialsList({
  recommendationId,
  onChanged,
}: {
  recommendationId: string
  onChanged?: () => void
}) {
  // What was loaded, and for which recommendation: data that belongs to another id reads as "loading", so
  // switching recommendation needs no synchronous reset inside the effect below. The card is also keyed by
  // id where it is rendered, so the confirmation and error state start clean for each recommendation.
  const [loaded, setLoaded] = useState<{ id: string; state: State } | null>(null)
  const state: State = loaded !== null && loaded.id === recommendationId ? loaded.state : { status: "loading" }
  const setState = useCallback((next: State) => setLoaded({ id: recommendationId, state: next }), [recommendationId])
  const [confirming, setConfirming] = useState<SimilarMaterial | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const alive = useRef(true)
  // A second click while a request is in flight must not send a second request: state updates are
  // asynchronous, a ref is not.
  const inFlight = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchSimilarMaterialsView(recommendationId)
      .then((view) => {
        if (!cancelled) setState({ status: "ready", view })
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" })
      })
    return () => {
      cancelled = true
    }
  }, [recommendationId, setState])

  const run = useCallback(
    async (key: string, action: () => Promise<{ view: SimilarMaterialsView }>) => {
      if (inFlight.current) return
      inFlight.current = true
      setBusy(key)
      setActionError(null)
      try {
        const change = await action()
        if (!alive.current) return
        setState({ status: "ready", view: change.view })
        setConfirming(null)
        setReason("")
        onChanged?.()
      } catch (error) {
        if (alive.current) setActionError(changeErrorMessage(error))
      } finally {
        inFlight.current = false
        if (alive.current) setBusy(null)
      }
    },
    [onChanged, setState],
  )

  return (
    <SimilarMaterialsCard
      state={state}
      confirming={confirming}
      reason={reason}
      busy={busy}
      actionError={actionError}
      onAskRemove={(item) => {
        setActionError(null)
        setReason("")
        setConfirming(item)
      }}
      onCancel={() => {
        setConfirming(null)
        setReason("")
      }}
      onReasonChange={setReason}
      onConfirmRemove={(item) =>
        run(keyOf(item), () => excludeSimilarMaterial(recommendationId, item.material, item.plant, reason))
      }
      onRestore={(entry) => run(keyOf(entry), () => restoreSimilarMaterial(recommendationId, entry.material, entry.plant))}
    />
  )
}
