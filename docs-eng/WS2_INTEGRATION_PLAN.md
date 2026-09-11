> **HISTORICAL — the layer this describes has been removed.**
>
> The TypeScript CPI client (`src/lib/sap/`) and its scripts were deleted on
> 2026-09-11. SAP access is now owned by the Python backend, at
> `backend/app/integrations/sap/`, because two implementations of one wire
> protocol would need fixing twice every time SAP drifts — and it demonstrably
> drifts (`Edm.Decimal` → `Edm.String`, a changed requisition key, both inside a
> week).
>
> **This document is kept deliberately.** The findings in it were measured
> against live CPI and are still true of SAP: the paging instability, the
> silently-ignored filters, the zero-row entity sets, the `$count` failures.
> Every one of them is now encoded in
> `backend/app/integrations/sap/known_conditions.py` and its tests.
>
> What is no longer true: the file paths, the `npm run` commands, and the
> per-set "flip to live" mechanics. Do not follow those.

# WS2 — SAP Integration and Data Contract (W2.1 → W2.7)

**Scope:** initiatives I07, I08, I13.
**Situation:** no Azure instance yet. CPI *is* reachable from a workstation.
**Goal of this phase:** build and test everything that does *not* require the live
environment, behind seams that are swapped — not rewritten — on the day Azure lands.

> **Status: W2.7 has been run, and two team-lead rulings have landed.** Discovery
> re-swept **08-Sep 14:16**; `ZMM_KPI02_SRV` is registered and that gate is
> **passed**. Separately, the team lead has (1) replaced the OAR identifier —
> **MRP Type (`MARC.DISMM`), treating `ND` and `PD` as OAR** — *not*
> `MARA.EXTWG`. `Dismm` is **already live and exposed**, so the EXTWG blocker
> dissolves; one conflict still needs resolving before we build on it — see
> [§1.6](#16-the-oar-rule-has-changed-mrp-type-replaces-extwg). And (2) named the
> reservation-time assistant's session field: **`Bednr`** (requirement tracking
> number), not the placeholder `Zzaisession` this doc had been carrying. `Bednr`
> is a real, live field elsewhere in SAP but **not yet exposed on
> `ReservationItemSet`** — still open, but now a concrete exposure request
> instead of an unresolved design question. See §1.7.

> **Update — 09-Sep 2026 sweep.** A follow-up discovery run found SAP had fixed
> two of §1's blockers: `$count` on `PurchaseRequisitionSet` (now 1,553) and
> `GoodsMovementItemSet` (now 68,616) — both previously HTTP 500 — and
> `ReservationItemSet` no longer returns zero rows (now 1,000). `Bednr` is
> still not exposed on `ReservationItemSet` (§1.7 unchanged), and
> `MaterialValuationSet` / `MonthlyMovementStatisticSet` still return zero.
> The same sweep also showed ~30 fields across 10 entity sets changing
> `Edm.Decimal` -> `Edm.String` (the same kind of change §1.2/§3 already
> documents happening to `Netpr`/`Netwr`) — `generated-contract.ts` has since
> been regenerated to match (Phase 11), with no decoding-logic changes needed:
> §3's "decode by declared type, never by shape" design was already built to
> absorb exactly this. The dated tables and numbers below (§1, §4, §7.3, §10)
> are left as the **08-Sep 14:16 snapshot they're labelled as** — the
> historical record of what was known when each task was designed. For
> current numbers, see
> [`docs-eng/phase_summary.md`](phase_summary.md#phase-10--sap-fixed-two-of-the-three-top-blockers-2026-09-09)
> (Phases 10–11) and the always-regenerated
> [`docs-eng/SET_READINESS.md`](SET_READINESS.md).

> **How to read this doc.** Every task has the same five headings:
> *What it means*, *What we do now*, *What we cannot do*, *Mock or placeholder*,
> *How we test it*. If you only read one section, read
> [§11 Order of work](#11-order-of-work).

---

## 1. Where we actually stand

Measured facts from `data-generator/discovery/`, swept **08-Sep 14:16**.

| Fact | Evidence | Change |
|---|---|---|
| **All 21 entity sets are exposed** | `entity_sets.csv` — 14 on `ZVZI_KPI02_SHARED_SRV` + 7 on `ZMM_KPI02_SRV`, 229 properties total | **was 14 of 21** |
| **`ZMM_KPI02_SRV` is registered** | `metadata_ZMM_KPI02_SRV.xml` now **19,129 bytes**, 7 sets, 75 properties | **was 0 bytes** |
| **OAR is identified by MRP Type, and it is live** | `MaterialPlantSet.Dismm`, `Edm.String`, non-key — exposed and populated | **new: unblocks scope** |
| **3 sets return zero rows** | `counts.csv` — `ReservationItemSet` **0**, `MaterialValuationSet` **0**, `MonthlyMovementStatisticSet` **0** | top blocker |
| **2 sets cannot report `$count`** | `PurchaseRequisitionSet`, `GoodsMovementItemSet` — HTTP 500 | **was 3** |
| **`PurchaseOrderItemSet` `$count` is fixed** | now returns **11,074** | **was HTTP 500** |
| **FR-9 is feasible** | `fr9_check.txt` — `MATERIAL` **26,405** · `MATERIAL`+`MARC` **7,220** · `BANF` **2,912** | **was 3× HTTP 500** |
| **Change documents are large** | `ChangeDocItemSet` **929,151** · `ChangeDocHeaderSet` **241,685** | filter-only |
| **`MARA.EXTWG` is still not exposed** | `MaterialSet` still 7 properties | **no longer blocking** — see §1.6 |

### 1.1 The gates

1. **ZMM_KPI02_SRV registration — CLOSED.** Service responds, all 7 sets present
   with real keys and types. Every property name we had guessed is now measured.
2. **EXTWG exposure — WITHDRAWN, not closed.** The dependency is gone because the
   rule changed, not because SAP exposed the field. OAR now comes from
   `MARC.DISMM`, which is already live. **W2.4's bet paid off in the strongest
   possible way** — the identifying field changed *entirely*, and because scope
   was never hard-coded that is still a config change.
3. **Empty reservations — the remaining top blocker.** See §1.3.
4. **The ND/PD overlap question — new.** See §1.6. Needs one answer from VZI
   before the scope config is trusted, and three `$count` calls can settle it.

### 1.2 What the sweep confirmed, and what it corrected

Our assumed property names were mostly right. Three were not.

| Assumption | Reality | Impact |
|---|---|---|
| `ChangeDocItemSet.ValueOld` / `ValueNew` | **`Value_old` / `Value_new`** — underscored | Our guess was wrong. Any code written against the CamelCase form would have failed. This is exactly what the gate existed to catch |
| `ChangeDocItemSet` key = 5 fields incl. `Tabname`, `Fname` | Key is **3 fields only**: `Objectclas`, `Objectid`, `Changenr`. `Tabname` and `Fname` are **non-key** | **The OData key is not row-unique.** One change document touching several fields returns several rows sharing one key. Any dedup or upsert keyed on the entity key will collapse real rows — see §1.4 |
| `ReservationItemSet.Zzaisession` exists | **Absent, and confirmed by the team lead not to be the plan.** The invented Z-field name is withdrawn — the real target is **`Bednr`** (requirement tracking number), to be added to `ReservationItemSet` | Not a "which field?" question any more, but a "not yet exposed on this set" one — see §1.7 |
| `Objectclas`, `Tabname` filterable | **Confirmed** — FR-9 filters return real counts | FR-9 (did the recommendation get applied in SAP?) is feasible. Assumption retired |
| `ReservationItemSet` core fields (`Rsnum`, `Rspos`, `Bdter`, `Bdmng`, `Enmng`, `Banfn`, `Bnfpo`, `Bwart`, `Wempf`…) | **All confirmed**, correct names and types | I08/I13 reservation logic can now be written against real names |
| `MaterialValuationSet` all 9 fields | **All confirmed** exactly | I07 valuation logic is safe |
| `ChangeDocHeaderSet` all 7 fields | **All confirmed**. Note `Utime` is **`Edm.Time`** | A third date/time type to handle in the parser — not `Edm.DateTime` |

**Two properties we did not know about** appeared on `ReservationItemSet`:
`Umwrk` and `Umlgo` (receiving plant and storage location on a transfer).
These are directly useful to I13 redeployment — worth a look before building
that screen around anything else.

**One type regression on a live set.** `PurchaseOrderItemSet.Netpr` and
`.Netwr` changed from **`Edm.Decimal` → `Edm.String`**. Prices and net values
now arrive as strings. Nothing else on the 14 shared sets changed. This is a
silent-corruption risk if anything does arithmetic without parsing, and it is
the single best argument for the W2.5 contract tests.

### 1.3 Registered but empty

`ReservationItemSet` and `MaterialValuationSet` respond correctly and return
**zero rows**. `MonthlyMovementStatisticSet` likewise.

This is worse for planning than the dead service was, because it *looks* fixed:

- **`ReservationItemSet` = 0.** Reservations are the backbone of I13 consumption
  plans and the anchor for the I08 repair session. With no rows, neither
  initiative can be validated against live data at all.
- **`MaterialValuationSet` = 0.** I07's stock value and value-of-avoided-purchase
  figures have no live source.
- **`MonthlyMovementStatisticSet` = 0.** Not used by the three initiatives; ignore.

**Raise this with the SAP team as a distinct question from registration.** The
likely causes are a dev client genuinely holding no reservation or valuation
data, an authorisation filter on the CPI user, or a projection returning nothing
without a mandatory filter. Ask which — they need different fixes, and only the
first is "wait for a fuller client".

Note the contrast: `ChangeDocHeaderSet` (241,685) and `BatchStockSet` (26,889)
return plenty on the same service, so the service and its auth are fine. The
emptiness is per-set.

### 1.4 Volume

`ChangeDocItemSet` holds **929,151** rows and `ChangeDocHeaderSet` **241,685**.
At 1,000 rows per page that is 930 requests for a full extract of one set.

**Never bulk-extract these.** I07 reads change documents to answer a narrow
question — "was this recommendation applied in SAP?" — which is a filtered
lookup, not an extract. The FR-9 counts show the filters work and cut hard:
`Objectclas eq 'MATERIAL' and Tabname eq 'MARC'` reduces 929,151 to **7,220**.

Design the change-document reader as filter-first from the start. And note the
key problem from §1.2: with `Tabname`/`Fname` non-key, filter on them at SAP
and treat `(Objectclas, Objectid, Changenr, Tabname, Fname)` as the *composite
identity* in our own storage, regardless of what OData calls the key.

### 1.5 Generator state

`generate.py` was updated correctly alongside the sweep:

- `NOT_EXPOSED_SETS` and `NOT_EXPOSED_KEYS` are now **`{}`** — all four
  previously-mocked sets take their definitions from discovery automatically.
- Generated CSVs picked up the corrections without hand-editing:
  `ChangeDocItemSet.csv` now has `Value_new,Value_old`; `ReservationItemSet.csv`
  gained `Umwrk,Umlgo`.
- Three new files appeared — `BatchStockSet.csv`,
  `MonthlyMovementStatisticSet.csv`, `StockMovementStatisticSet.csv` — with
  **correct headers and 0 rows**, because the generator has no fabrication logic
  for sets no initiative reads. Correct behaviour, not a bug. Leave them.
- `PENDING_FIELDS` now holds **two** entries — `MaterialSet.Sernp` and
  `ReservationItemSet.Zzaisession`. `Extwg` was removed as withdrawn, not
  exposed (§1.6(d)). **The `Zzaisession` entry needs renaming to `Bednr`** now
  that the team lead has named the real target field (§1.7) — not done yet,
  tracked here so it lands with the rest of the generator changes.
- The OAR rule is encoded as configuration: `OAR_MRP_TYPES = ("ND", "PD")`,
  with an invariant guard and the pending verification noted inline (§1.6(d)).

**Rule for this phase, revised:** property names on all 21 sets are measured, so
build against them directly. The remaining assumptions are two *fields*
(`Sernp`, the session-tracking field now identified as `Bednr` — §1.7), the
*OAR value set* (`ND`/`PD` — §1.6), and three *business constants*
(`REPAIR_DOC_TYPE`, `REPAIR_ITEM_CATEGORY`, the movement-type set). Keep
exactly those behind config.

### 1.6 The OAR rule has changed: MRP Type replaces EXTWG

**The team lead's ruling (08-Sep):** OAR is identified by the **MRP Type** field,
and **both `ND` and `PD`** are to be treated as OAR stock items. `MARA.EXTWG` is
no longer the mechanism.

**This is good news, and it unblocks the largest open dependency in WS2.**

| | Before (EXTWG) | Now (MRP Type) |
|---|---|---|
| SAP field | `MARA.EXTWG` | **`MARC.DISMM`** |
| Entity set | `MaterialSet` | **`MaterialPlantSet`** |
| Exposed? | **No** — blocked on SAP | **Yes — live now**, `Edm.String`, non-key |
| Value(s) | `100`, unconfirmed | **`ND`, `PD`** (of `VB`/`ND`/`PD`) |
| Grain | one value per material | **one value per material *per plant*** |
| Server-side `$filter`? | impossible (field absent) | **possible today** |

Three consequences, in order of importance.

**(a) Scope becomes plant-dependent.** This is the real design change and it is
easy to miss. `EXTWG` lives on MARA — one value per material, globally. `DISMM`
lives on MARC — **one value per material per plant.** A material can be `ND` in
one plant and `VB` in another, so "is this material OAR?" is no longer a
well-formed question; "is this material OAR *in this plant*?" is.

This is real, not hypothetical: live `MaterialPlantSet` holds **2,177** rows
against **2,034** materials, so ~143 materials already carry more than one
plant row. In the synthetic data 466 of 2,000 materials span two plants, and 7
of those differ in OAR scope between plants.

So the scope module's signature changes from `isInScope(material)` to
**`isInScope(material, plant)`**, and every I07/I13 screen that lists "OAR
materials" has to decide whether it means a material-plant row or a material
rolled up across plants. **Settle that before building the scope module**, since
it propagates into every selector. W2.4 absorbs it cleanly *if* it is decided
now; retrofitting a plant dimension later is exactly the rework W2.4 exists to
avoid.

**(b) Server-side filtering is available immediately.** Because `Dismm` is live,
the scope predicate can be pushed to SAP today:

```
APIPath  = sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/MaterialPlantSet
APIQuery = $filter=Dismm eq 'ND' or Dismm eq 'PD'
```

No interim "unavailable" state is needed for scope any more. Build the pushdown
path as the primary one, and keep the in-memory predicate only for tests and for
rows already in hand.

**(c) ⚠️ The ND/PD set conflicts with our data model, and one of the two is
wrong.** This needs an answer before the rule is trusted.

`generate.py:705-709` states the opposite of the new rule, explicitly:

> *"OAR materials carry no maintained ROP or maximum, and the same MRP type (PD)
> as the general population — which is why EXTWG, not the MRP type, is what
> identifies them."*

And the generator acts on that: OAR → `PD`; **`OBSOLETE` → `ND`**
(`generate.py:716-718`); everything else → `VB` (60%) or `PD` (40%). Measured
against the current synthetic data:

| `Dismm` | rows | truly OAR | not OAR |
|---|---|---|---|
| `ND` | 95 | **0** | 95 — *all `OBSOLETE`* |
| `PD` | 1,200 | 390 | **810** |
| `VB` | 1,225 | 0 | 1,225 |

Applying "ND + PD = OAR" to this data selects **1,295** rows of which only
**390** are OAR — a **70% false-positive rate** — and it classifies **every
obsolete material as OAR**, which is precisely backwards.

**Read that correctly:** it was evidence about *our model*, not about SAP. The
synthetic data had been fabricated on the EXTWG assumption, so of course it
disagreed. The team lead's statement is about the real system and supersedes our
guess — so **the generator has been corrected to the new rule** (§1.6(d)). What
remains unverified is the rule's fit against *live* data, which is what the three
counts below settle.

**Settle it with three calls.** `Dismm` is live and `MaterialPlantSet.$count`
works (2,177), so the real distribution is one filtered count per value:

```powershell
# From the workstation that has CPI access. Expect three numbers summing to ~2,177.
# APIQuery=$filter=Dismm eq 'ND'   -> ?
# APIQuery=$filter=Dismm eq 'PD'   -> ?
# APIQuery=$filter=Dismm eq 'VB'   -> ?
```

Interpretation, decided in advance:

- **`ND`+`PD` is a clear minority** (say under ~40% of 2,177) → the rule is
  plausible. Adopt it, and fix the generator (below).
- **`ND`+`PD` is most of the catalogue** → the rule as stated would put nearly
  everything in scope. Go back to the team lead: either OAR is narrower than
  MRP Type alone, or "OAR" here means something broader than the I13 scope we
  have been building. **Do not silently widen I13's scope to most of the
  catalogue** — that is the failure mode this check exists to prevent.

Two questions to ask alongside it:
1. **Is `ND` really in scope?** `ND` is conventionally "no planning", which sits
   naturally with on-demand ordering — but our data uses it for obsolete stock.
   Ask how obsolete materials are excluded from OAR, or whether they are.
2. **Is the rule plant-level or material-level?** i.e. does one `ND`/`PD` plant
   row make the material OAR everywhere? This is question (a) above, and it is
   the team lead's to answer, not ours to assume.

### 1.6(d) Generator — corrected and regenerated

`generate.py` now encodes the MRP-type rule. Done:

- **`OAR_EXTWG = "100"` replaced** by `OAR_MRP_TYPES = ("ND", "PD")`,
  `PLANNED_MRP_TYPE = "VB"`, `OBSOLETE_MRP_TYPE = "ND"` and
  `OBSOLETE_MATERIAL_STATUS = "01"` — one config block, with the pending
  verification recorded against it.
- **`Dismm` is now derived *from* `is_oar`**, not the reverse. The configured
  value set is the single place the OAR definition lives, mirroring what W2.4
  does in the app.
- **The obsolete collision is resolved by a second field, not by MRP type.**
  `MARA.MSTAE` (`'01'` for obsolete) is **already live on `MaterialSet`** and is
  the orthogonal signal. Obsolete materials keep `ND`, because in SAP they
  genuinely have no planning maintained — so the overlap is retained *on
  purpose* to make the second predicate testable.
  **The scope rule is therefore `Dismm in (ND, PD) AND Mstae ne '01'`.**
- **`Extwg` removed** from `PENDING_FIELDS` and from the `MaterialSet` row
  build. The header is now `Matnr,Lvorm,Mtart,Matkl,Bismt,Meins,Mstae,Sernp`.
  Note it is *withdrawn*, not exposed — so `generate.py`'s
  "no longer pending" warning could never have caught this. Rule changes come
  from people, not `$metadata`.
- **OAR scope is now decided per plant, not per material.** Because `DISMM` sits
  on MARC, a material can be planned on demand in one plant and reorder-point
  planned in another. `OAR_SINGLE_PLANT_SHARE = 0.15` gives that shape to a
  slice of the multi-plant OAR materials, and `MaterialPlantRow.is_oar` carries
  the plant-level truth. Two plant-grain consumers were branching on the
  *material*-level flag and are now corrected: the stock simulation and the OAR
  reservation-chain builder. Without this the fixture could not express the
  case at all — see below.
- **An invariant guard** refuses to run if `PLANNED_MRP_TYPE` is ever put inside
  `OAR_MRP_TYPES`, which would silently select every planned material as OAR.
- Superseded comments rewritten; regenerated and committed.

The synthetic data now exercises both the naive rule and the refined one:

| `Dismm` | rows | in OAR scope | obsolete (`Mstae='01'`) |
|---|---|---|---|
| `VB` | 1,975 | no | **0** |
| `ND` | 294 | yes | **109** |
| `PD` | 198 | yes | 0 |

- Naive `Dismm in (ND, PD)` → **492** rows
- Refined `… AND Mstae ne '01'` → **383** rows — the true OAR population
- The second predicate excludes exactly the **109** obsolete rows, and `VB`
  contains **no** obsolete material at all, so there are no false positives from
  the general population
- **7 materials are now OAR in one plant and `VB` in another** — the roll-up
  test case from §1.6(a), which the fixture previously could not produce at all.
  Verified end to end on `000000000030000014`: plant 4000 is `VB` with a
  maintained reorder point and stock, plant 1000 is `PD` with no ROP and all
  three of the material's reservations

That is a deliberately useful fixture: the naive rule over-selects by a knowable
amount, the refinement removes exactly the right rows, and the plant-grain edge
case is present rather than hypothetical. Row counts shifted slightly overall
(`MaterialPlantSet` 2,520 → 2,467) because dropping the `Extwg` random draw
changed the RNG call sequence — expected, and still deterministic under
`SEED = 42`.

**What is still not settled:** whether `ND`+`PD` is a minority of the *live*
catalogue. The generator now assumes the rule is right; the three counts test
that assumption against reality.

### 1.7 Does this solve `Sernp` and the session field? No — but the session field has a name now: `Bednr`, not `Zzaisession`

Short answer: **no, and neither was ever connected to OAR identification.** The
MRP-type ruling changes only *which materials are in scope*. Separately, the
team lead has now answered the session-field question we had marked as an open
design decision — and the answer retires the placeholder name we had been
carrying since the FRS stage.

**The team lead's ruling on the session field:** `ReservationItemSet.Zzaisession`
was never a real field — it does not exist in the currently exposed schema, and
it was always our own placeholder name for "whichever field ends up carrying
this." The actual plan is to **use `BEDNR` (the requirement tracking number)
to carry the session ID**, added to `ReservationItemSet` in future.

This is a materially different situation from a "candidates: `SGTXT`, `WEMPF`,
`ABLAD`, or a Z-append" open question — `Bednr` is not a guess among several, it
is a **named, real SAP field already live elsewhere.** Confirmed independently
from `discovery/properties.csv`: `Bednr` (`Edm.String`) is exposed today on both
`PurchaseRequisitionSet` and `PurchaseOrderItemSet` — it is EBAN/EKPO's
requirement-tracking-number field, used conventionally to link requisition and
PO items to an external tracking reference. `generate.py` already carries it on
those two sets, currently blank (`"Bednr": ""`).

**What is not yet true: `Bednr` is not exposed on `ReservationItemSet`.**
`RESB` (the reservation table) has its own `BEDNR` field in SAP, but the
08-Sep sweep confirmed it is absent from the current `ReservationItemSet`
projection — same shape of gap as `Extwg` on `MaterialSet`: a real SAP field
that exists on the underlying table but has not yet been added to *this*
OData projection. So this is now an **exposure request** to the SAP team
("add `Bednr` to the `ReservationItemSet` projection"), not a *designation*
decision waiting on someone to pick a field name.

| Field | What it is | Status | Blocks? |
|---|---|---|---|
| `MaterialSet.Extwg` | External material group — the *old* OAR identifier | **No longer needed.** Superseded by `MARC.DISMM`. Remove from `PENDING_FIELDS` | Nothing. Withdrawn |
| `MaterialSet.Sernp` | Serial number profile (MARA) | **Still not exposed.** Unchanged by either ruling | **Nothing today.** Only needed for a *future* serial-grain repair register; present on ~18% of 80-series PO lines. No current I07/I08/I13 requirement depends on it — safe to leave pending |
| `ReservationItemSet.Bednr` *(was tracked as `Zzaisession`)* | Requirement tracking number — the field that will carry the reservation-time assistant's session ID | **Named, real, live elsewhere — not yet exposed on `ReservationItemSet`.** An exposure request to the SAP team, with a known target field, not an open design question | **Yes, for the reservation-time assistant's deep-link launch.** Same practical blocker as before, but now a concrete, trackable ask instead of an unresolved "which field" question |

**Why this still cannot ride along with the OAR fix.** `Dismm` needed nothing
from SAP because it was *already exposed* — the ruling just pointed us at an
existing, populated field. `Bednr` on `ReservationItemSet` needs the opposite:
SAP has to add it to the projection before it exists there at all, the same as
`Extwg` did for `MaterialSet`. That is still a SAP-side change with its own
lead time, so treat it as still open — just no longer ambiguous about *what*
is open.

**Generator and config follow-up, not yet done:**
- Rename the `PENDING_FIELDS["ReservationItemSet"]` entry from `Zzaisession` to
  `Bednr`, and drop the "candidates: `SGTXT`, `WEMPF`, `ABLAD`, or a Z-append"
  framing — it is resolved.
- Update `generate.py`'s session-ID row build (`"Zzaisession": session_id`) to
  `"Bednr": session_id`, matching the column rename.
- Since `Bednr` already exists as a real column on `PurchaseRequisitionSet` and
  `PurchaseOrderItemSet` (currently blank), double-check the reservation-side
  session values do not collide in meaning with the tracking-number usage on
  those two sets if any future logic reads `Bednr` across sets.
- Keep the field name behind a single config key regardless — if SAP exposes a
  *different* field on `ReservationItemSet` than expected, or reuses `Bednr` for
  something else, the fix stays a one-line change.

Note the assistant is designed to run **on demand without the BAdI**, so this
blocks the deep-link launch path, not the assistant itself.

---

## 2. W2.1 — CPI client library

> OAuth client-credentials token handling, `APIPath`/`APIQuery` construction,
> OData v2 envelope parsing, retry and error mapping.
> *Plan note: "already proven against the live endpoint from a workstation, so
> this is codification rather than discovery."*

### What it means
One reusable module that knows how to talk to SAP through CPI, so no feature
code ever builds a URL or handles a token itself. Every call goes through it.

The shape is proven twice over now — `cpi_discovery.py` has completed two live
sweeps. W2.1 is turning that working Python into a proper TypeScript library.

### What we do now
Build it **completely**. This needs no Azure — it is pure code.

- **Token handling.** Client-credentials POST to `CPI_TOKEN_URL`, cache the
  token in memory, refresh on expiry *and* re-fetch once on a `401`.
  `cpi_discovery.py` already does the retry-once-on-401 dance — copy it.
- **Request construction.** All calls go to `{CPI_BASE_URL}/http/SAPECC/OdataConsumption`
  with two query params: `APIPath` (e.g. `sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/MaterialSet`)
  and `APIQuery` (e.g. `$filter=...&$top=1000`). This double-envelope is easy
  to get wrong — hide it entirely inside the client.
- **Response parsing.** OData **v2**, not v4. Payloads are wrapped as
  `{ "d": { "results": [...] } }`. Three scalar types need explicit handling,
  now confirmed from live metadata:
  - `Edm.DateTime` → `/Date(1757280000000)/`
  - **`Edm.Time`** → ISO-8601 duration form (`PT14H16M00S`). `ChangeDocHeaderSet.Utime`
    is the one that uses it. Do not feed it to a date parser.
  - `Edm.Decimal` → arrives as a **string** (`"1234.56"`).
  Parse from the **generated contract**, not from guesswork — which also means
  `PurchaseOrderItemSet.Netpr`/`.Netwr`, now declared `Edm.String`, get flagged
  rather than silently coerced. See §1.2.
- **Retry and error mapping.** Exponential backoff on `5xx`, one retry on
  `401`, no retry on `4xx`. Map to typed errors: `AuthError`,
  `TransientError`, `NotFoundError`, `ContractError`.
- **Config, not constants.** Service names, the CPI path and credentials all
  come from environment variables. Nothing hard-coded.
- **Distinguish empty from broken.** Given §1.3, a zero-row response must be a
  distinct, reportable outcome — never conflated with a failed call or an
  unfiltered default. Three live sets return zero today; the client must make
  that visible rather than returning a bland empty array.

### What we cannot do
Prove it against the real endpoint *from inside Azure*. Retry timing under real
CPI latency and TLS behaviour from within the VNet are W2.2. Note the client
itself **can** now be smoke-tested against live CPI from a workstation — worth
doing once the parser is written.

### Mock or placeholder
Point the client's base URL at a **local fake CPI server** that speaks the same
double-envelope protocol and returns OData v2 payloads built from
`data-generator/generated/sap/*.csv`. That is W2.6, and it is what makes W2.1
testable in CI. One environment variable chooses fake or real.

### How we test it
- Token cache reused within expiry; refreshed after; re-fetched once on `401`.
- `APIPath`/`APIQuery` encoding for filters containing spaces and quotes —
  including the `or`-joined scope filter from §1.6(b).
- `/Date(...)/` → date; `PT14H16M00S` → time; `"1234.56"` → number; `null` → null.
- A field declared `Edm.String` that holds a numeric value is **not** silently
  turned into a number (the `Netpr` case).
- Backoff fires on `500`, does **not** fire on `404`.
- Zero rows → explicit empty result, distinguishable from an error.

### Done when
Every `generated/sap/*.csv` set reads end-to-end through the client from the
fake gateway, with zero SAP-specific code outside the library.

---

## 3. W2.2 — Connectivity smoke test from VZI

> Auth, TLS, paging against the CPI endpoint from inside the VZI environment.
> *Depends on W1.2 (environment provisioned) and W2.1.*

### What it means
The first real proof that our code, running **inside Azure**, can reach CPI —
not just from a laptop. It catches firewall rules, private endpoints, TLS
inspection and IP allow-listing.

### What we do now
Only the *inside-Azure* half is blocked. Write the test now so that on Azure day
it is a five-minute answer instead of a half-day investigation.

The smoke test should:
1. Fetch a token and print its expiry — **never the token itself.**
2. Fetch `$metadata` for both services; print HTTP status and byte count.
   Expect ~37,800 and ~19,100 bytes — a large deviation is itself a signal.
3. Read one page of `MaterialSet` (`$top=10`); print row count.
4. Read two pages to prove paging works.
5. Print the resolved endpoint hostname and TLS certificate issuer.
6. **Assert the known-conditions set** from §1 — 2 `$count` failures, 3 zero-row
   sets, and the **`Dismm` value distribution** from §1.6(c). Report each as
   *still true* or *changed*.
7. Exit non-zero on any failure, with the failing step named.

Step 6 turns the smoke test into a live re-verification, so W2.7 becomes a
command anyone can run rather than a scheduled event. **Add the three `Dismm`
counts to it now** — that makes §1.6(c) a standing check rather than a one-off
question, and catches the day someone re-maintains MRP types in bulk.

### What we cannot do
Anything about the network itself: private endpoints, DNS resolution inside the
VNet, CPI-side IP allow-listing. **Add one item to the W1.1 access checklist
now:** confirm with VZI IT whether CPI restricts inbound by IP, and if so get
the Azure egress IP or NAT gateway address allow-listed *before* W2.2 runs.
That single question, asked late, costs a day.

### Mock or placeholder
The fake gateway stands in for CPI in CI. Steps 5 and 6 report localhost values
locally — expected, and the test should say so rather than fail.

### How we test it
The test *is* the test. Verify it passes against the fake gateway and against
live CPI from the workstation, and that it fails loudly and specifically when
pointed at a wrong URL or given a bad secret.

### Done when
`npm run smoke:cpi` passes against both the fake gateway and live CPI from a
workstation, and is documented as the first command to run on Azure.

---

## 4. W2.3 — Pagination with a fallback

> Page-until-short-page where `$count` is unavailable
> (~~`PurchaseRequisitionSet`, `GoodsMovementItemSet`, `PurchaseOrderItemSet`~~
> — **now two sets**, see below).

### What it means
Normally you ask SAP "how many rows?" then loop until you have them all. On
**two** sets that question still returns HTTP 500, so the extractor needs a
second strategy: keep asking for pages until a page comes back smaller than the
page size, then stop.

**Updated from the sweep.** `PurchaseOrderItemSet.$count` is **fixed** (11,074).
Still broken: `PurchaseRequisitionSet` and `GoodsMovementItemSet`. Both remain
business-critical — requisitions drive I07's PR-to-PO view, goods movements
drive consumption everywhere — so the fallback is still a main path, not an edge
case.

### What we do now
Build both modes fully.

- **Counted mode:** `GET .../$count` → loop `$skip`/`$top` until total reached.
- **Fallback mode:** loop `$skip`/`$top` until a page returns fewer than
  `$top` rows. Never trust an empty first page as "no data" without one retry —
  and given §1.3, log a zero-row result as a distinct, reportable outcome.
- **Per-set configuration**, not a hard-coded list. Each set is marked
  `countMode: "counted" | "fallback" | "auto"`. `"auto"` tries `$count` once and
  demotes itself to fallback on `5xx`, logging the demotion. The
  `PurchaseOrderItemSet` fix is proof this pays for itself: with `"auto"` that
  set self-promoted with **no code change at all**.
- **Filter-first for the change-document sets.** §1.4 — 929,151 and 241,685
  rows. Mark these `extract: "filtered-only"` in config and make an unfiltered
  full extract *impossible*, not merely discouraged.
- **A safety ceiling.** Max pages and max rows per extraction. With a 929k-row
  set now reachable, this is no longer theoretical.
- **Stable ordering.** `$skip`/`$top` paging without `$orderby` on the entity
  key can silently skip or duplicate rows. Add `$orderby` for every paged read.
  **Caveat from §1.2:** on `ChangeDocItemSet` the declared key is not row-unique,
  so ordering by key alone is not deterministic — order by
  `Objectclas,Objectid,Changenr,Tabname,Fname` there.

### What we cannot do
Confirm real page-size limits, CPI timeout behaviour on large pages, or whether
`$skip` beyond a certain depth degrades. Make page size configurable per set and
start conservative (1,000). The 929k-row set is where deep-`$skip` degradation
would first show — test it against live CPI from the workstation before Azure.

### Mock or placeholder
The fake gateway must reproduce the *current* state deliberately: serve `$count`
for the 12 working sets and **return HTTP 500 for `$count` on exactly
`PurchaseRequisitionSet` and `GoodsMovementItemSet`**, so the fallback path is
exercised by default and not only in a unit test.

### How we test it
- Counted mode over a set whose size is known from the CSV row count.
- Fallback mode over the two broken sets — total rows must equal CSV rows.
- Row count exact when total is an exact multiple of page size (the classic
  off-by-one: does it make one extra empty call and stop cleanly?).
- No duplicate and no missing keys across page boundaries — including on
  `ChangeDocItemSet` with its non-unique key.
- An unfiltered read of a `filtered-only` set is **refused**.
- Safety ceiling trips and reports rather than hanging.

### Done when
All 21 sets extract to the correct row count through the fake gateway, two via
fallback, with zero key duplication and the change-document sets filter-gated.

---

## 5. W2.4 — Material-scope filter as configuration

> OAR selection expressed as a config-driven predicate on the external material
> group, not hard-coded.
> **CRITICAL SEQUENCING ITEM** — built before EXTWG is exposed so the fix is a
> configuration change rather than rework across I07 and I13.

**The task just proved its worth, and its target field changed.** The plan
anticipated a *value* change on `EXTWG`. What actually happened is bigger: the
**entire identifying field** moved from `MARA.EXTWG` to `MARC.DISMM`, with a
different value set and a different grain. Had scope been written inline, that
would be rework across every I07 and I13 selector. Because it was deferred to
config, it is a config rewrite plus one signature change.

Still the highest-leverage task in WS2. Still has **no dependencies**. Do it
first — and now it is *better* positioned, because the field it needs is live.

### What it means
"Which materials are in scope?" is asked in dozens of places across I07 and
I13. As of the 08-Sep ruling the answer is **`MARC.DISMM` ∈ {`ND`, `PD`}**,
read from `MaterialPlantSet` — a field that is **already exposed and populated**.

Two things still need settling before the config is trusted, both in §1.6:
the **ND/PD overlap question** (c), and whether scope is **plant-level or
material-level** (a). Build the module so either answer is configuration.

### What we do now
Build it completely — it is pure configuration design, and the field is live.

- **One scope module** exposing `isInScope(material, plant)`. Nothing outside it
  may reference `Dismm`, `"ND"` or `"PD"`.
  **Take the plant argument even if the rule turns out to be material-level** —
  it is trivial to ignore an argument and expensive to add a dimension later.
- **Config-driven, declarative.** A scope is data, not code — and the rule is
  already a two-predicate `and`, so support that from the first commit:
  ```
  { and: [ { field: "Dismm", op: "in",  values: ["ND", "PD"] },
           { field: "Mstae", op: "ne",  value:  "01"         } ] }
  ```
  `Dismm` lives on `MaterialPlantSet` and `Mstae` on `MaterialSet`, so the
  predicate spans **two entity sets** — the scope module needs both rows, and
  the pushdown path needs two filtered reads joined on `Matnr`, not one.
  Support `in`, `notIn`, `ne`, `startsWith`, `and` and `or`.
- **A roll-up policy, explicit in config.** When a material is `ND` in one plant
  and `VB` in another, is it OAR? Express this as
  `rollup: "any-plant" | "all-plants" | "per-plant-only"` rather than deciding it
  inside a selector. This is §1.6(a), and it is the one thing most likely to be
  got wrong silently.
- **Named scopes**, because the three initiatives do not share one definition:
  `oar` (I13 whole scope, I07 OAR flag), `repairable` (I08 — 80-series
  materials, a different rule entirely), and `all`.
- **Pushdown as the primary path.** `Dismm` is live, so generate the OData
  `$filter` and filter at SAP:
  `$filter=Dismm eq 'ND' or Dismm eq 'PD'` on `MaterialPlantSet`. Keep the
  in-memory predicate for tests and for rows already in hand. The same pushdown
  machinery is what §1.4's change-document filters need — build it once.
- **Keep the unavailable state anyway.** Scope no longer needs it — `Dismm` is
  there — but §1.3 means "empty" and "unavailable" will still both occur in I13
  and I08 screens via reservations. Keep the three-way distinction
  (in-scope / not-in-scope / cannot-determine) so a data outage never renders as
  a confident empty list.

### What we cannot do
Confirm the ND/PD set is right until the three `$count` calls in §1.6(c) come
back, or decide the roll-up policy — that is the team lead's call. Both are
config values, so neither blocks building the module. **Do not regenerate
synthetic data against the new rule until the counts land** (§1.6).

### Mock or placeholder
**None — the scope path needs no stub at all.** `Dismm` is live on real
`MaterialPlantSet`, and `generated/sap/MaterialPlantSet.csv` carries it
populated under the **corrected** rule (§1.6(d)), with `Mstae` on
`MaterialSet` as the obsolete signal. Both predicates and the pushdown path are
testable today, against a fixture where the naive rule selects 492 rows and the
refined one 383.

`Extwg` is **gone** from the synthetic `MaterialSet.csv` header. Nothing should
reference it.

Still assert *behaviour* rather than hard-coded counts — "the filter selects
exactly the rows matching the configured predicate" — so the tests survive the
next regeneration, and survive the `ND`/`PD` value set changing if §1.6(c) comes
back unfavourable.

### How we test it
- Config with one value, several values, a `notIn`, and an `and` combination.
- Generated `$filter` string is correct OData v2, URL-encodes properly, and
  handles the `or`-joined multi-value case.
- In-memory predicate and pushdown filter select the **same** rows — this
  equivalence test is what makes server-side filtering safe.
- Each `rollup` mode over a material that is OAR in one plant and `VB` in
  another gives the documented answer. The synthetic data now contains **7**
  such materials plus 466 two-plant materials overall, so this is directly
  testable (§1.6(d)).
- Field absent → `unavailable`, not `false`.
- `grep` test in CI: the literals `"ND"`, `"PD"`, `"01"` and the tokens
  `Dismm`/`Mstae` appear **only** in the config file and the scope module. Add `Extwg` and `"100"` to
  the same test as *forbidden everywhere* — they are withdrawn, and a stray
  reference is now a bug rather than a placeholder.

### Done when
Changing one config value re-scopes I07 and I13 end to end, the roll-up policy
is explicit, and the grep test proves no leakage of either the new or the
withdrawn identifiers.

---

## 6. W2.5 — Contract tests from live `$metadata`

> Set names, entity keys, property names and types, pagination and `$count`
> behaviour. Wired into CI; records the known `$count` failures as expected
> conditions.

### What it means
A test suite that reads the saved `$metadata` and asserts "the fields our code
expects are the fields SAP actually has." When SAP changes something, a test
fails with a clear message instead of a feature breaking in UAT.

**The sweep just proved the case for this task.** Between two runs four hours
apart, SAP changed `Netpr` and `Netwr` from `Edm.Decimal` to `Edm.String` on a
live set. Nothing announced it; it surfaced only from a `git diff` of
`properties.csv`. Had contract tests existed, that would have been a red build
with a precise message. It is the cheapest possible catch and we very nearly
missed it.

### What we do now
Build it fully from the saved metadata — no live access needed.

- **Generate a typed contract** from `discovery/properties.csv` and
  `entity_sets.csv`: per set, its properties, types, nullability and keys. All
  **21 sets and 229 properties** are now real, so the whole contract is measured
  — no `source: "assumed"` tagging is needed any more. Check the generated file
  into git; it is the baseline to diff against.
- **Assert what our code needs.** Per initiative, declare required fields and
  test each exists with a compatible type. This is what catches the `Value_old`
  vs `ValueOld` class of error — which was a *real* wrong assumption we held
  until 14:16 today.
- **Known-conditions file, rewritten against measured state.** Each entry
  asserts the condition still holds and **fails loudly when it changes, in
  either direction**:

  | Condition | State as of 08-Sep 14:16 |
  |---|---|
  | `$count` HTTP 500 on `PurchaseRequisitionSet`, `GoodsMovementItemSet` | expected-broken |
  | `$count` on `PurchaseOrderItemSet` | **expected-working** (11,074) — was broken, guard the regression |
  | `ReservationItemSet` count | expected **0** — flip to a hard failure once SAP answers §1.3 |
  | `MaterialValuationSet` count | expected **0** — same |
  | `MonthlyMovementStatisticSet` count | expected **0**, unused |
  | **`Dismm` on `MaterialPlantSet`** | **expected present, `Edm.String`** — the OAR identifier. A hard failure if it ever disappears |
  | **`Dismm` value domain** | expected ⊆ {`VB`, `ND`, `PD`} — fail on an unseen value, which would mean the OAR rule is incomplete |
  | `Sernp` on `MaterialSet` | expected **absent** |
  | `Bednr` on `ReservationItemSet` | expected **absent** — the session-tracking field, confirmed named by the team lead but not yet exposed on this set (§1.7). Renamed from the placeholder `Zzaisession` |
  | `Bednr` on `PurchaseRequisitionSet` / `PurchaseOrderItemSet` | expected **present, `Edm.String`** — the same field, already live elsewhere, evidence it is a real SAP field rather than a guess |
  | `ChangeDocItemSet` key | expected **3 fields**, `Tabname`/`Fname` non-key |
  | `PurchaseOrderItemSet.Netpr` / `.Netwr` | expected **`Edm.String`** — assert deliberately, so a revert to `Decimal` is also caught |
  | `ChangeDocHeaderSet.Utime` | expected **`Edm.Time`** |
  | `ChangeDocItemSet` / `ChangeDocHeaderSet` volume | expected > 100,000 — filter-only sets |

  *Retired conditions:* `ZMM_KPI02_SRV` unreachable; `Bnfpo` not a key (it is a
  plain non-key property on `ReservationItemSet`, matching the dictionary note);
  the `NOT_EXPOSED_SETS` assumed-property set; and **`Extwg` on `MaterialSet`** —
  no longer pending, because the field is no longer wanted (§1.6).
- **Type-mapping tests.** `Edm.DateTime` → date, `Edm.Time` → time-of-day,
  `Edm.Decimal` → number-from-string, `Edm.String` with leading zeros stays a
  string (SAP material numbers are zero-padded — parsing `000000000012345` as a
  number is a classic data-loss bug).
- **A metadata-drift test.** Diff the live `$metadata` against the checked-in
  contract and fail on any unannounced change. This is the `Netpr` catch,
  automated. Run it in the W2.2 smoke test too.
- **CI wiring.** There is **still no test runner and no `.github/` in this
  repo.** Add Vitest and a GitHub Actions workflow as part of this task; without
  it, "wired into CI" cannot be satisfied.

### What we cannot do
Nothing significant any more. The suite runs against a snapshot of *real*
metadata for all 21 sets, and the drift test covers the live comparison.

### Mock or placeholder
None needed for the contract itself. The two still-unexposed fields (`Sernp`,
`Bednr` on `ReservationItemSet`) are declared pending and asserted absent.

### How we test it
Meta-test the suite: feed it a deliberately altered metadata XML — renamed
property, changed key, changed type — and confirm each mutation produces a
failure naming the set, the property and the nature of the change. Use the real
`Netpr` `Decimal`→`String` change as the first fixture; we know the answer.

### Done when
`npm test` runs green in CI against the snapshot, every row of the
known-conditions table is asserted, and a mutated metadata file produces clear,
specific failures.

---

## 7. W2.6 — Reduced mock gateway

> For the eight items not yet available: the seven `ZMM_KPI02_SRV` sets plus a
> stubbed external material group field.
> *Scope cut sharply from the original synthetic-data plan: 14 of 21 sets are
> live, so only the gap is mocked.*

### What it means
A local server that pretends to be CPI, so the whole app runs with no SAP at all.

**The sweep and the MRP-type ruling between them reduced this task's mocking
scope to almost nothing.** The plan's "eight items" were 7 ZMM sets + EXTWG. All
7 sets are now real, and EXTWG is **withdrawn rather than pending** — so the
schema gap is down to **two fields**, neither of which blocks current work
(§1.7). What remains is a *volume* gap: three live sets return zero rows (§1.3),
so synthetic data is still how I07, I08 and I13 get exercised end to end.

So the gateway is still needed, and still serves all 21 sets — but as a
**test-and-development fixture**, no longer as a stand-in for missing schema.

### The problem this task must actually solve

This remains the most important finding in this document, and neither the sweep
nor the ruling touched it.

The data generator produces **14 MB of SAP-shaped CSVs across 28 files** (21 SAP
+ 7 platform). The app is fed by **hand-written TypeScript fixtures** in
`src/lib/mock-data.ts` (1,161 lines) and `src/features/*/data/*.ts`.

**Nothing in `src/` reads a single generated CSV.** The two datasets have never
met. SAP-shaped data no code consumes; UI-shaped data SAP will never produce. On
Azure day that gap surfaces all at once.

**Closing it is the real deliverable of W2.6.** Everything else in WS2 is
insurance; this is the integration itself. It is now also the *largest*
remaining task, since the mocking half keeps shrinking.

### What we do now
1. **Fake CPI server.** Reads `generated/sap/*.csv`, serves the CPI
   double-envelope contract (`APIPath` + `APIQuery`), returns OData v2 JSON with
   `/Date(...)/` timestamps, `Edm.Time` durations and numeric-strings —
   *deliberately reproducing SAP's awkward formats,* because a mock that returns
   clean JSON tests nothing. Type each field from the generated contract, so
   `Netpr` comes back as a string exactly as live CPI now does.
2. **Support the query surface we actually use:** `$top`, `$skip`, `$filter`
   (eq, and, **or**), `$orderby`, `$select`, `$count`. Two `$filter` cases are
   now first-class requirements, not nice-to-haves: `Objectclas`/`Tabname` for
   §1.4, and the **`or`-joined `Dismm` scope filter** for §1.6(b).
3. **Reproduce the current known state on purpose.** `$count` → HTTP 500 on the
   two broken sets, working on the rest. And a mode that makes
   `ReservationItemSet` and `MaterialValuationSet` return **zero rows**, so we
   can prove the app degrades honestly against the live condition that exists
   today. Being able to simulate §1.3 is what stops it becoming an Azure-day
   surprise.
4. **Per-set routing.** Config decides, per entity set, `mock` or `live`. All 21
   sets can now go `live` for schema purposes, while the three zero-row sets stay
   `mock` for data. **This is the single most valuable artefact in WS2** — it
   turns go-live from a cutover into a per-set dial, and it is what makes the
   §1.3 blocker survivable rather than blocking.
5. **Build the mapping layer.** Transform SAP-shaped rows into the view models
   the UI already uses — an explicit mapper per initiative — then **replace the
   hand-written fixtures with mapper output.** Where a fixture holds data no SAP
   field can produce, that is a finding: log it as a gap, do not invent a source.
   Write the mappers against the **real** property names now available for all
   21 sets; there is no longer any excuse for guessing. **Route every
   scope decision through the W2.4 module** — no mapper should read `Dismm`.
6. **Mark synthetic data visibly.** Every response from a mocked set carries a
   flag, and the UI shows a persistent "synthetic data" banner. With schema now
   real but reservation data empty, the risk of demoing synthetic numbers as real
   has gone *up*, not down.

### What we cannot do
Validate the mapping for fields we have never seen populated — which, thanks to
§1.3, still includes **every reservation and valuation field**. Their names and
types are confirmed; their real values, distributions and edge cases are not.
And the calibration gap stands: ~2,034 dev materials against **>45,000 in
production**, so synthetic volumes prove function, not performance.

### Mock or placeholder
Placeholders remaining — now a short list, and shorter than yesterday:
- ~~**`MaterialSet.Extwg`**~~ — **withdrawn.** Superseded by `MARC.DISMM`,
  which is live. Remove from `PENDING_FIELDS`; nothing should read it (§1.6).
- **`MaterialSet.Sernp`** — not exposed, and **not blocking**. Only needed for a
  future serial-grain repair register (§1.7).
- **`ReservationItemSet.Bednr`** *(renamed from the placeholder `Zzaisession`)*
  — the AI-session field is **now named** (requirement tracking number) but
  **still not exposed** on `ReservationItemSet`. A SAP **exposure request**, not
  a design decision any more — see §1.7. Keep it behind a single config key
  naming the field, so a further correction stays a one-line change.
- **The OAR value set `{ND, PD}`** — stated by the team lead, not yet reconciled
  with our data model (§1.6(c)). Config value, pending three `$count` calls.
- **`REPAIR_DOC_TYPE = "ZREP"` and `REPAIR_ITEM_CATEGORY = "3"`** — I08 decision
  D7, **still pending SAP confirmation**. Move both to config alongside the
  scope rules.
- **W2.9 lead-time source** — `MARC.PLIFZ` is live on `MaterialPlantSet`. Put
  lead time behind a provider interface with one implementation reading `Plifz`;
  if the I11 Z-program writes to a Z-table instead, only the provider changes.

### How we test it
- Every set, all rows, correct types, through the real client (W2.1).
- The two `$count` 500s trigger fallback paging (W2.3).
- Zero-row mode on reservations and valuation → app renders honest
  "no data" states, distinct from "unavailable", with no crash and no silent zeros.
- Per-set routing: with all sets on `mock` the app is fully functional; flipping
  one set to `live` against an unreachable URL fails **only that set**.
- Mapper round-trip: SAP-shaped row → view model → the fields the UI renders.
- A filtered `ChangeDocItemSet` read returns the expected subset; an unfiltered
  one is refused.
- The `Dismm` scope filter returns the same rows through the gateway as the
  in-memory predicate does.

### Done when
The app runs entirely off the fake gateway with the hand-written fixtures
deleted, and one config file switches any set between mock and live.

---

## 8. W2.7 — Re-verify after the SAP fixes — **RUN 08-Sep 14:16**

> **GATE.** Re-run the discovery sweep, confirm EXTWG is exposed and
> `ZMM_KPI02_SRV` responds, capture the real property names on `ChangeDocItem`
> and `ReservationItem`.

### Result: two of three objectives, and the third was withdrawn

| Objective | Result |
|---|---|
| `ZMM_KPI02_SRV` responds | ✅ **Yes.** 19,129 bytes, 7 sets, 75 properties |
| Real property names on `ChangeDocItem` and `ReservationItem` | ✅ **Captured.** One assumption corrected (`Value_old`/`Value_new`), one key structure corrected, two new fields found (`Umwrk`, `Umlgo`) |
| `EXTWG` exposed | ⊘ **Withdrawn.** Still absent — but no longer needed. The team lead replaced the OAR identifier with **MRP Type (`MARC.DISMM`)**, which is already live (§1.6) |

**Bonus findings the sweep was not looking for:** `PurchaseOrderItemSet.$count`
fixed; FR-9 proven feasible; `Netpr`/`Netwr` type regression; change-document
volumes; and the three zero-row sets — the last of which is now the top blocker.
Full detail in §1.

### What this unblocks, immediately
- **Write against real names.** All 229 properties on all 21 sets are measured.
  No mapper needs to guess.
- **Scope is buildable end to end, today.** `Dismm` is live, so W2.4 can be
  built *and* pushdown-tested against real metadata rather than a stub (§1.6(b)).
- **FR-9 is buildable.** `Objectclas` and `Tabname` filter correctly and cut
  929,151 rows to 7,220. I07 can verify whether a recommendation was applied.
- **`NOT_EXPOSED_SETS` is empty.** The generator's schema is fully
  discovery-driven, exactly as designed.
- **W2.5 has a real contract for every set** — no assumed-source tagging.

### What is still open
1. **The ND/PD overlap question** (§1.6(c)) — three `$count` calls settle it.
   Highest-value open item because it is cheap and it gates the scope config.
2. **Plant-level vs material-level scope** (§1.6(a)) — team lead's call. Decide
   before the scope module is written, not after.
3. **Zero rows on `ReservationItemSet` and `MaterialValuationSet`** (§1.3) —
   raise as a separate question from registration. Largest remaining unknown.
4. **`Bednr` exposure on `ReservationItemSet`** *(was tracked as the
   `Zzaisession` designation question)* — the field is now **named** by the
   team lead, but still needs adding to the SAP projection, tied to W2.8. **Not
   solved by the MRP-type ruling** (§1.7).
5. **`ZREP` / item-category 3** — I08 decision D7 confirmation.
6. **The entity dictionary xlsx** — still absent, so `dictionary_gaps.csv` still
   cannot be produced (§9.4).

### Follow-up actions
- **Run the three `Dismm` `$count` calls** and record the distribution (§1.6(c)).
- Ask whether `ND` (obsolete in our model) is genuinely in OAR scope, and how
  obsolete materials are excluded — or whether they are.
- Ask whether the OAR rule is plant-level or material-level.
- Ask the SAP team **why** the three sets are empty: no dev data, an auth filter,
  or a projection needing a mandatory filter? Different fixes.
- Ask whether the `Netpr`/`Netwr` type change to `Edm.String` was intentional,
  and whether more are planned. Then assert it in W2.5 either way.
- Confirm the `ChangeDocItemSet` key is intentionally 3 fields, and that
  `(Objectclas, Objectid, Changenr, Tabname, Fname)` is the right composite
  identity for our own storage.
- **After the counts land:** apply the generator changes in §1.6, remove `Extwg`
  from `PENDING_FIELDS`, regenerate and re-commit.
- **Rename `PENDING_FIELDS["ReservationItemSet"]` from `Zzaisession` to
  `Bednr`** in `generate.py`, and update the row build to match (§1.7). Not
  gated on anything else — do it whenever the generator is next touched.
- **Ask the SAP team to add `Bednr` to the `ReservationItemSet` projection.**
  Since the field already exists on `PurchaseRequisitionSet` and
  `PurchaseOrderItemSet`, this is a scoped, concrete ask rather than an open
  design question.

### Next re-verification
There is no longer a single scheduled gate. Fold the checks into the W2.2 smoke
test (step 6) — including the three `Dismm` counts and a check for `Bednr` on
`ReservationItemSet` — so the known-conditions set is verified on demand, and
re-run the full sweep when SAP announces a fix, specifically on reservation
data or the `Bednr` exposure.

---

## 9. Runbook: re-running `cpi_discovery.py`

The 08-Sep 14:16 run went through cleanly, so this is now a repeat-run
procedure. §9.1's blockers are resolved; the rest still applies.

### 9.1 Prerequisites — resolved, keep them that way

Both first-run blockers are cleared: `requests` and `openpyxl` are installed,
and the `.env` path is resolved. Two small items are still worth doing so the
next person does not rediscover them:

```powershell
cd c:\Users\varad\OneDrive\Desktop\spares-ai\data-generator
pip freeze | Out-File -Encoding utf8 requirements.txt
```

- **Pin the dependencies** (above) — `requirements.txt` still does not exist.
- **Create `.env.example`** — key names only, no values. The README references
  it and it still does not exist. Required keys: `CPI_CLIENT_ID`,
  `CPI_CLIENT_SECRET`, `CPI_TOKEN_URL`, `CPI_BASE_URL`.

Note the script defaults to `.env` *next to itself* (`data-generator/.env`)
while the real file is at the **repo root**. Whichever way it was resolved this
run, `--env-file ..\.env` is the form that always works:

```powershell
python cpi_discovery.py --env-file ..\.env --out .\discovery
```

**Never print or commit the secret.** `.gitignore:34` covers `.env*`.

### 9.2 Before the next run — commit, then overwrite

`discovery/` is now **committed** (`8220af6`), so `git diff` alone answers "what
changed" and no archive copy is needed. That is the workflow from here: commit
the current state, re-run, diff.

**Do not delete `discovery/`.** `generate.py` reads `discovery/properties.csv`
as its schema source, and the value of a re-run is the diff — which is exactly
how the `Netpr` type change was caught.

If you want a belt-and-braces copy anyway:

```powershell
cd c:\Users\varad\OneDrive\Desktop\spares-ai\data-generator
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
Copy-Item -Recurse .\discovery ".\discovery-baseline-$stamp"
```

The script uses `mkdir(exist_ok=True)` and overwrites each output, so no cleanup
is needed. One caveat: **stale files are not removed.** If a set disappears from
`$metadata`, its rows vanish from the CSVs — the diff catches it, a glance at
the folder does not.

### 9.3 The run

Dry-run first, without the `$count` sweep — proves auth, TLS and both
`$metadata` calls in seconds:

```powershell
python cpi_discovery.py --env-file ..\.env --out .\discovery --skip-counts
```

Expected output as of this sweep:

- `token OK`
- `[ZVZI_KPI02_SHARED_SRV] 14 entity sets in $metadata; expected 14`
- `[ZMM_KPI02_SRV] 7 entity sets in $metadata; expected 7`
- **No** `MISSING vs technical list` or `EXTRA in $metadata` lines

Any deviation from that is the finding. Then the full run with counts:

```powershell
python cpi_discovery.py --env-file ..\.env --out .\discovery | Tee-Object -FilePath ".\discovery\run-$stamp.log"
```

Keep the log — it is the only record of *when* a sweep ran and what `$count`
returned. **The 14:16 run was not logged;** start doing this from the next one.

### 9.4 The dictionary gap report — still unavailable

`--dictionary` needs `VZI_Entity_Dictionary_I07_I08_I13_v1_*.xlsx`, which is
**still not in this repo** — `docs/` holds only `VZI_AI_Dev_Plan_v2.4.xlsx`.
Get it from the SAP/BA team, then:

```powershell
python cpi_discovery.py --env-file ..\.env --out .\discovery --dictionary ..\docs\VZI_Entity_Dictionary_I07_I08_I13_v1_2.xlsx
```

`dictionary_gaps.csv` is the field-by-field FRS-vs-SAP comparison. It matters
more now, not less: with all 229 properties measured, it would tell us in one
pass which FRS fields have no SAP home — a question we currently answer by hand.
It would also have flagged the EXTWG-vs-MRP-type divergence months earlier.

### 9.5 Reading the results

```powershell
cd c:\Users\varad\OneDrive\Desktop\spares-ai\data-generator

# 1. Both services present, with set counts
Import-Csv .\discovery\entity_sets.csv | Group-Object service | Select-Object Count, Name

# 2. The OAR identifier - is Dismm still on MaterialPlantSet?
Import-Csv .\discovery\properties.csv | Where-Object { $_.entity_set -eq "MaterialPlantSet" } | Select-Object property, type

# 3. $count failures  (expect PurchaseRequisitionSet, GoodsMovementItemSet)
Import-Csv .\discovery\counts.csv | Where-Object { $_.count -like "HTTP*" }

# 4. Zero-row sets  (expect ReservationItemSet, MaterialValuationSet, MonthlyMovementStatisticSet)
Import-Csv .\discovery\counts.csv | Where-Object { $_.count -eq "0" }

# 5. ZMM property names and keys
Import-Csv .\discovery\properties.csv | Where-Object { $_.service -eq "ZMM_KPI02_SRV" } | Format-Table entity_set, property, type, is_key

# 6. FR-9 feasibility  (expect real counts, not HTTP 500)
Get-Content .\discovery\fr9_check.txt

# 7. Still-pending fields  (expect Sernp, Bednr on ReservationItemSet - Extwg is withdrawn)
Select-String -Path .\generate.py -Pattern "PENDING_FIELDS" -Context 0,20

# 8. What changed - the single most valuable command here
git diff data-generator/discovery/
```

Query 8 is what caught the `Netpr` type change. Run it every time.

### 9.6 Improve the script — still worth doing

Four small changes, all outstanding:

1. **Write metadata only on success, and always record the failure.** The
   response body is written before the status is checked — which is how a
   0-byte file ended up on disk this morning with no error recorded anywhere.
   Write a `run_summary.json` with timestamp, per-service HTTP status, set counts
   and the missing/extra lists.
2. **Distinguish zero from failed in `counts.csv`.** Right now `0` and a real
   count look alike, and a dead service is *absent* rather than reported dead.
   Given §1.3 is a top blocker, this column needs three states: a count,
   `EMPTY`, or an error.
3. **Add a value-distribution probe** for low-cardinality fields that drive
   business rules — `Dismm` above all. One filtered `$count` per distinct value,
   written to a `value_domains.csv`. This is exactly the §1.6(c) question, and it
   should be a standing output rather than a one-off investigation.
4. **Add a `--baseline <dir>` diff mode.** `git diff` covers this now that
   `discovery/` is committed, so this is the lowest priority of the four.

### 9.7 After a sweep

```powershell
# Regenerate synthetic data from the new schema
cd c:\Users\varad\OneDrive\Desktop\spares-ai\data-generator
python generate.py

# Confirm row counts and column changes
Get-ChildItem .\generated\sap\*.csv | ForEach-Object { "{0,-34} {1}" -f $_.Name, ((Get-Content $_.FullName | Measure-Object -Line).Lines - 1) }

# Re-run contract tests - known-condition failures are GOOD NEWS
npm test
```

Then **check `PENDING_FIELDS` and `NOT_EXPOSED_SETS`.** `generate.py` warns when
a `PENDING_FIELDS` entry is no longer pending, or when a `NOT_EXPOSED_SETS`
entry is now discovered — read those warnings, they are the handover from SAP's
fix to our config. This sweep's handover was done correctly:
`NOT_EXPOSED_SETS` went to `{}`.

Note the warning mechanism only catches *exposure* changes. It cannot catch a
**rule** change like §1.6 — `Extwg` is still legitimately absent, so nothing
warns that it is no longer wanted. Rule changes arrive from people, not from
`$metadata`; that is why §1.6 is written down.

Commit the discovery outputs, the regenerated CSVs, `generate.py` and the run
log as **one commit**, so the schema baseline is traceable. `docs/` is gitignored
(`.gitignore:44`) but `data-generator/` and `docs-eng/` are not.

---

## 10. Things not in the plan that I would add

1. **Run the three `Dismm` counts before writing the scope config** (§1.6(c)).
   Cheapest high-value action available: three calls, and it either confirms the
   new OAR rule or catches a 70%-false-positive scope definition before any code
   depends on it.
2. **Get the plant-vs-material roll-up decided** (§1.6(a)). A silent wrong
   answer here propagates into every I07 and I13 selector.
3. **Wire the app to the generated CSVs.** Covered in W2.6, restated because it
   is the largest real risk and nothing this week touched it: 14 MB of SAP-shaped
   data and 1,161 lines of hand-written fixtures that have never met.
4. **Chase the zero-row answer** (§1.3). Registration without data is not a
   satisfied dependency, and it is easy to mistake for one.
5. **Add a test runner and CI.** Still no Vitest/Jest and no `.github/`. The
   `Netpr` type change is the concrete argument: a silent contract change slipped
   through in four hours and only a manual diff caught it.
6. **Commit `discovery/` on every sweep.** Done for this one (`8220af6`); keep it
   up, and `git diff` stays the drift detector.
7. **Ask about CPI inbound IP restrictions now** (see W2.2). A late answer costs
   a day of Azure time.
8. **Chase the entity dictionary xlsx** (§9.4).
9. **Put every unconfirmed business constant in one config file.** The OAR MRP-type
   set, `REPAIR_DOC_TYPE`, `REPAIR_ITEM_CATEGORY`, `SCRAPPING`,
   `OVERDUE_GRACE_DAYS`, `PLAN_GRACE_DAYS` and the movement types are constants
   in `generate.py` and will be re-declared in the app. One shared
   `sap-contract.config.ts` with a `confirmed: true|false` flag per value makes
   the assumption surface visible in one screen — and reviewable by VZI.
   **§1.6 is the argument for this:** the OAR identifier changed field, value set
   *and* grain in a single Slack message. Assume the rest will too.
10. **Zero-padding discipline.** SAP material numbers are zero-padded strings
    (`000000000012345`). Decide once whether the app stores padded or unpadded,
    normalise at the client boundary, and test it. Getting this wrong late causes
    joins that silently match nothing. `Matnr` is `Edm.String` on every set that
    carries it — confirmed across all 21.
11. **Treat calibration as a known limitation, not a task.** ~2,034 dev materials
    vs >45,000 production. Synthetic volumes prove correctness, never performance.
    Add one load test against 45,000 synthetic materials. The 929k-row
    `ChangeDocItemSet` is a second, already-real scale case.
12. **Reset the dates.** The plan runs 08-Sep to 25-Sep 2026 with W2.7 gated on
    11-Sep. W2.7 in fact ran on **08-Sep**, three days early — so re-baseline
    against the actual Azure date rather than carrying dead dates either way.
13. **Keep a per-set readiness table in the repo** — set, live/mock, `$count`
    mode, row count, pending fields, blocking dependency. One page answering
    "what works today?" without reading code. With 21 sets in three distinct
    states (working / count-broken / empty) this is now genuinely needed, and it
    becomes the go-live checklist.

---

## 11. Order of work

Sequenced by dependency and by how much risk each item removes.

| # | Task | Why here | Needs Azure? |
|---|---|---|---|
| — | ~~**W2.7** discovery sweep~~ | ✅ **Done 08-Sep 14:16.** Gate passed; see §8 | — |
| 0 | **Three `Dismm` `$count` calls** + the two OAR questions | Three calls and two answers, and they gate item 1. Do this first — it is minutes of work | CPI only |
| 1 | **W2.4** scope config | No dependencies, and its field is now **live**, so it can be built *and* pushdown-tested for real. Still the highest-leverage task | No |
| 2 | Test runner + CI | Everything after this is testable. The `Netpr` change is the argument | No |
| 3 | **W2.5** contract tests | All 21 sets are real, so fully buildable — and it locks the schema before mappers are written against it | No |
| 4 | **W2.1** CPI client | Foundation for W2.2, W2.3, W2.6. Parses from the W2.5 contract | No |
| 5 | **W2.6a** fake gateway | Makes W2.1 and W2.3 verifiable; simulates the §1.3 zero-row state | No |
| 6 | **W2.3** paging | Needs client + gateway to test both modes and the filter-only gate | No |
| 7 | **W2.6b** mapping layer, fixtures replaced | The actual integration. Now the largest remaining task | No |
| 8 | **W2.2** smoke test | Write it, pass it against the gateway **and against live CPI from the workstation** | No |
| 9 | Per-set flip to live | Config dial, set by set | **Yes** |

**Why item 0 exists.** It was not in the plan because the OAR rule was not
expected to change. Three filtered counts either confirm the new rule or reveal
that "ND + PD" selects most of the catalogue — and that answer changes what W2.4's
config says on day one. Doing it after item 1 means writing the config twice.

**Generator correction fits between 0 and 1** — once the counts land, apply the
§1.6 changes to `generate.py`, regenerate, re-commit. The scope module's tests
should assert behaviour rather than row counts so they survive that regeneration.

Items 1–8 need no Azure; item 0 needs CPI from a workstation, which we have.
Only the per-set flip to live needs Azure, and by then it is a config change plus
a smoke test.

---

## 12. Out of scope for this phase

The WS2 tasks beyond W2.7, and why they are not detailed here:

- **W2.8** Reservation-entry BAdI launch contract — a design/contract note with
  the SAP team and NTT; no ABAP stream exists today. The assistant is designed to
  run on demand without it. **The session-tracking field is now named:** the
  team lead has confirmed `Bednr` (requirement tracking number) as the field,
  not the placeholder `Zzaisession` we had been carrying — see §1.7. What
  remains is a straightforward **exposure request** (add `Bednr` to
  `ReservationItemSet`), not an open design decision. Chase it as part of W2.8.
- **W2.9** I11 lead-time source — `MARC.PLIFZ` is live on `MaterialPlantSet`, so
  if the Z-program updates it in place there is no work. If it writes to a
  Z-table, that table must be exposed. Handle behind the provider interface in
  W2.6. Note `MaterialPlantSet` is now doing double duty as both the lead-time
  and the OAR-scope source, so it is the most load-bearing set in the system.
- **W2.10** PR event listener — off the critical path, blocked on a Stream 2
  payload schema that has not been shared.
