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

# Testing Guide — how to check WS2 yourself

You've read [phase_summary.md](phase_summary.md) and want to verify it
firsthand instead of taking it on faith. This is the walkthrough: what to run,
what you should see, and how to tell "working" from "broken."

Do these roughly in order — each section builds on the confidence of the one
before it. None of them modify real SAP data (everything here is read-only).

---

## 0. Before you start

You need `data-generator/.env` to exist with real CPI credentials
(`CPI_BASE_URL`, `CPI_TOKEN_URL`, `CPI_CLIENT_ID`, `CPI_CLIENT_SECRET`). It's
already on disk in this repo (gitignored, never committed) — check with:

```
ls data-generator/.env
```

If it's missing, sections 1, 4, and 6 (anything touching *live* SAP) won't
work, but everything else (2, 3, 5, 7, 8) runs completely offline.

Install dependencies once if you haven't:

```
npm install
```

---

## 1. The automated test suite — the fastest signal

```
npm test
```

**What you should see:** 256 tests, all green, finishing in a few seconds.
This is fully offline — no SAP, no gateway needed.

What's actually being checked (so a failure means something specific to you):

| Area | File(s) | What it proves |
|---|---|---|
| OAR scope rule | `src/lib/sap/scope/*.test.ts` | The `Dismm`/`Mstae` rule, all three rollup policies, the `$filter` strings generated |
| No hard-coded SAP fields | `src/lib/sap/scope/no-leakage.test.ts` | No file outside `src/lib/sap/scope/` mentions OAR field codes, and nothing references the retired `Extwg` rule |
| SAP contract / drift | `src/lib/sap/contract/*.test.ts` | The 21-table/229-field schema baseline, decoding of SAP's odd date/time/decimal formats, per-initiative field requirements |
| CPI client | `src/lib/sap/client/*.test.ts` | Token caching/refresh, retry-with-backoff, the four error types |
| Fake gateway | `src/lib/sap/gateway/*.test.ts` | The filter-language parser, and that it replays SAP's actual quirks |
| Paging | `src/lib/sap/paging/paginate.test.ts` | Counted vs. fallback vs. automatic paging, stable sort, hard ceilings |
| Field mapping | `src/lib/sap/mapping/mapping.test.ts` | Every screen field's declared source actually resolves |

Try it yourself: open any file under `src/lib/sap/scope/config.ts` and change
`"ND"` to `"XX"`, then rerun `npm test`. You should see specific scope tests
fail — a live demonstration that the suite actually checks behavior, not just
"does it run." Revert the change afterward.

**Watch mode**, if you're going to poke at the code: `npm run test:watch`.

---

## 2. The leakage guard, on purpose broken

This is the guard phase 2 built to stop anyone from hard-coding OAR field
values outside `src/lib/sap/scope/`. Prove it actually catches something:

1. Open any file outside `src/lib/sap/scope/`, e.g.
   [src/lib/sap/dataset-mode.ts](../src/lib/sap/dataset-mode.ts), and add a
   throwaway line: `const test = "Dismm"`.
2. Run `npm test`.
3. You should see `no-leakage.test.ts` fail, naming that exact file and line.
4. Remove the line.

If it doesn't fail, that's a real bug in the guard — worth reporting.

---

## 3. Run the app against the fake SAP gateway

This proves the whole client → gateway → paging → mapping chain works without
needing real SAP at all.

Terminal 1:
```
npm run gateway
```
Leave it running. It serves all 21 SAP tables on `localhost:4010` from the
synthetic CSVs in `data-generator/generated/sap/`, replaying SAP's current
faults (as of the 09-Sep 2026 sweep: zero broken row-counters, two empty
tables, padded numeric strings, `/Date(...)/` timestamps).

Try `npm run gateway -- --honest` instead to see the same data with those
faults switched off (i.e. how things behave once SAP itself is fixed).

Terminal 2, build the app's dataset from that SAP-shaped data:
```
npm run dataset:build
```
This reads through the real client/paging/mapping stack (not hand-typed
fixtures) and regenerates the three JSON files under
`src/features/initiative-*/data/generated/`. Diff them against what git
already has — if you haven't changed `generate.py`, they should come back
close to identical (there is some intentional randomness only if you touched
`SEED` in `data-generator/generate.py`).

Terminal 2, then run the app on that generated data:
```
NEXT_PUBLIC_DATASET=generated npm run dev
```
Open `http://localhost:3000`. What to actually look at:

- **[/inventory-planning/recommendations](http://localhost:3000/inventory-planning/recommendations)** (I07) — should load 200 rows. Model-comparison panels and "why this recommendation" bullets will be **empty** — that's the 14-field gap from Phase 7 made visible, not a bug.
- **[/repairable-spares/repair-register](http://localhost:3000/repairable-spares/repair-register)** (I08) — 321 repair chains. Open one; the vendor name (e.g. "Springbok Rewind Services (Pty) Ltd") should resolve through the real PO → vendor join.
- **[/oar-utilization/ledger](http://localhost:3000/oar-utilization/ledger)** (I13) — 742 consumption-plan lines. Materials will show plant `3000` rather than a named mine site, and circuit will show `Unassigned` — again, expected: no identity mapping exists yet (Phase 8).

Compare against the default demo data by dropping the env var:
```
npm run dev
```
Same screens, but hand-typed scenario data with named plants/materials —
this is what a stakeholder demo currently shows. The contrast between the two
runs *is* the deliverable from Phase 8: it shows exactly what's real vs.
invented today.

Stop the gateway (Ctrl+C in terminal 1) when done.

---

## 4. Talk to real SAP directly

Only if `data-generator/.env` has working credentials.

```
npm run smoke:cpi
```

This is the single command meant for "can we reach SAP at all" — 15 checks in
under a minute: login, schema fetch for both services, a real data read,
2-page paging with no row overlap, TLS certificate info, and a re-check of
every known SAP quirk (broken counters, empty tables, MRP-type distribution).

**What you should see:** all checks pass, ending with a certificate line
naming a real issuer (e.g. DigiCert) — that's your proof this actually hit
the network, not the fake gateway. If SAP's state has drifted since Phase 9
was written, this command will say so explicitly, e.g.:

```
CHANGED  $count on PurchaseRequisitionSet — NOW WORKS, returned 8861.
Set this set's countMode to "counted" in lib/sap/paging/config.ts.
```

That's not a failure of the test — it's the test doing its job. If you see a
`CHANGED` line, that's genuinely new information worth telling the team lead.

**Try breaking it on purpose** to confirm it fails usefully, not just
successfully:
- Temporarily set `CPI_CLIENT_SECRET` to garbage in `data-generator/.env` and
  rerun. You should get one clear error naming step 1 (login), not a cascade
  of 14 unrelated failures. Restore the real secret afterward.

---

## 5. Re-run the SAP discovery yourself

This is how Phase 0's MRP-type table was produced. Re-running it re-measures
live SAP right now, which is the most direct way to confirm those numbers
still hold (or to see if they've moved).

```
cd data-generator
python cpi_discovery.py --out discovery
```

Needs the same `.env` and Python with `requests` installed (`pip install -r
requirements.txt` if there's one, otherwise `pip install requests
python-dotenv`).

**What to check afterward:**
- `discovery/value_domains.csv` — look for the `Dismm` and `Mstae` rows; the
  percentages should roughly match the Phase 0 table (47% blank, 38% `PD`,
  8.5% `ND`, plus the six unexpected codes). If they've shifted meaningfully,
  that's worth flagging.
- `discovery/counts.csv` — confirm stock valuation and monthly movements are
  still the zero-row tables (item #3 in the outstanding questions list).
  Reservations was the third until the 09-Sep 2026 sweep fixed it (now 1,000
  rows) — if you see it drop back to 0, that's a regression worth flagging.

This will produce a git diff in `data-generator/discovery/*` — that's
expected and fine, it's exactly what you're checking.

---

## 6. Regenerate the synthetic data

```
cd data-generator
python generate.py
```

No credentials needed — reads `discovery/properties.csv` only. Deterministic
(`SEED = 42`), so the output should come back byte-identical to what's
already in `generated/`. Confirm with:

```
git status
```

If nothing changed, that's success — it proves the generator is truly
deterministic. If you *want* a different dataset, edit `SEED` or
`MATERIAL_COUNT` at the top of `generate.py` first.

After regenerating, rerun `npm test` — the scope module's tests read this
data directly, so this is also a check that generator changes haven't broken
the app's assumptions.

---

## 7. The contract / drift detector

Confirm the schema baseline still matches what's on disk, and that the
detector actually notices when it doesn't:

```
npm run contract:generate
git diff src/lib/sap/contract/generated-contract.ts
```

No diff = the committed contract still matches the last discovery sweep. A
diff means SAP's shape changed since the contract was last regenerated (or
you just ran a fresh discovery sweep in section 5) — read the diff, it should
describe the exact field/type/key change.

The tests in `src/lib/sap/contract/drift.test.ts` already cover the
"deliberately corrupt the schema four ways" proof from Phase 3 — you don't
need to redo that by hand, just note that `npm test` exercises it.

---

## 8. The reporting scripts

Two commands produce human-readable documents — spot-check that they still
match reality:

```
npm run gap-report
```
Regenerates [FIELD_SOURCE_GAPS.md](FIELD_SOURCE_GAPS.md). Diff it — if you
haven't added new screen fields, it should be unchanged.

```
npm run readiness
```
Regenerates [SET_READINESS.md](SET_READINESS.md) — the per-table go-live
checklist. Worth running after section 5 (a fresh discovery sweep), since it
reads `discovery/counts.csv`.

---

## 9. Lint (known pre-existing failure)

```
npm run lint
```

**Expected result: 3 errors**, all in
`src/components/materials/materials-explorer.tsx` and related files, about
`setState` inside effects. These predate all of WS2's work and are why lint
isn't wired into CI yet (see Phase 2's action items). If you see *more* than
3, or errors in different files, that's new and worth looking at; the
original 3 are already known and tracked.

---

## 10. CI

CI (`.github/workflows/ci.yml`) only runs once this branch is pushed to
GitHub — it hasn't run yet on this machine. If you want to confirm it works
before pushing for real, you can validate the workflow file locally with
[`act`](https://github.com/nektos/act) if you have Docker, or just push and
watch the Actions tab — the workflow runs `npm test` on every push to `main`
and every pull request.

---

## Quick reference

| # | Command | Needs SAP creds? | What it proves |
|---|---|---|---|
| 1 | `npm test` | No | 256 unit/contract/behavior tests pass |
| 2 | (manual) | No | The leakage guard actually catches violations |
| 3 | `npm run gateway` + `npm run dataset:build` + `NEXT_PUBLIC_DATASET=generated npm run dev` | No | Full app runs end-to-end on SAP-shaped data |
| 4 | `npm run smoke:cpi` | Yes | Real SAP is reachable and matches known conditions |
| 5 | `python cpi_discovery.py --out discovery` | Yes | Re-measures live SAP's actual field values |
| 6 | `python generate.py` | No | Synthetic data regenerates deterministically |
| 7 | `npm run contract:generate` | No (unless re-running 5 first) | Schema baseline still matches disk |
| 8 | `npm run gap-report` / `npm run readiness` | No | Reporting docs still match code/data |
| 9 | `npm run lint` | No | Only the 3 known pre-existing errors remain |
| 10 | push + GitHub Actions | No | CI runs the suite on push/PR |

If something here doesn't match what you see, that's more likely a real find
than a mistake in this guide — flag it rather than assuming you did it wrong.
