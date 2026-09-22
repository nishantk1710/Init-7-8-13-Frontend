# WS7 — Reservation-Time Assistant: frontend implementation plan

**Repo:** `Init-7-8-13-Frontend`
**Date:** 22 September 2026
**Covers:** W7.5 (assistant UI, session-ID issuance, deep-link entry point) and the
frontend half of W7.6 (session traceability and compliance), plus the screens
I08 FR-5/6/7 and I13 FR-2/3/4/7 need in order to be demonstrable.
**Reads against:** `VZI_AI_Dev_Plan_v2.4.xlsx` sheet *Dev Plan v2.4*, rows W7.1–W7.7;
Initiative 08 FRS v1.2; Initiative 13 FRS v1.2;
`Init-7-8-13-Backend/docs/WS7_Assistant_Implementation_Notes.md`;
`docs/WS7_Chat_Assistant_Backend_Plan.md`.

**Nothing in this plan has been built.** It is for review first.

---

## 1. What this plan is, in one paragraph

The backend half of WS7 is finished on `feat/vp/ws7-assistant`: both conversations
run end to end against seeded data, five append-only tables exist, and nine
endpoints are live. The frontend half does not exist at all. What this repo has
today is a **scripted mock chat** that plays a hand-written conversation in the
browser and writes nothing anywhere. This plan replaces it with a thin renderer
over the server-driven script, adds the session log and trace views that FR-8
acceptance is read from, and wires the justification record into the screens that
already claim to show it.

**The single most important structural fact:** the conversation is decided by the
backend, not by the browser. There is no step cursor to hold in React state, no
script to keep in sync, and no branch logic to reimplement in TypeScript. The
frontend posts an answer and renders whatever step comes back. Every design
decision below follows from that.

---

## 2. What this repo has today

Measured, not assumed.

### 2.1 Already live against the backend

| Area | Screens | Pattern |
| --- | --- | --- |
| I08 | Repair Register, repair detail, Declaration Queue, Coding Candidates | async server component → `lib/api/i8.ts` → **camelCase** wire |
| I13 | Ledger, WATCH, Aging Exceptions, Reclassification, Validation, Utilisation Dashboard | `"use client"` → `useI13Query` → `features/initiative-13/api/client.ts` → **snake_case** wire, mapped by hand |

### 2.2 Still fixture-backed, and honest about it

`lib/dataset-mode.ts` exists to let a demo-backed screen say so next to a real one.
Still on fixtures: I08 Overview, I08 Duplicate Guard, I13 Overview, I13
Redeployment, and the four cross-initiative selectors (`lib/aggregation.ts`,
`lib/chat-intents.ts`, `lib/material-router.ts`, the Material 360 adapter).

### 2.3 The mock chat — what it is and what it is not

`components/chat/chat-workspace.tsx` (489 lines) plays an authored script from
`lib/mock-data.ts`. It has a three-question OAR consumption-plan sequence, an I08
duplicate-repair guard, a condition-to-repair declaration prompt, a workflow
stepper, a simulated email panel and a trace panel.

**None of it reaches the backend.** It invents reservation numbers
(`RES-5003xx`), invents tracking IDs (`OAR-TRK-00xx`), classifies materials in the
browser via `lib/material-router.ts`, and issues no session reference at all. A
planner who completes the whole conversation leaves no record — which is the exact
thing both FRSs count ("advice given, not acted on").

It is, however, a **good specification of the interaction**, and its presentational
pieces (`chat-message.tsx`, `option-card.tsx`, `option-group.tsx`, `chat-body.tsx`,
`suggested-questions.tsx`) are reusable. The plan keeps the components and
replaces the brain.

---

## 3. The contract, exactly as the backend serves it

Nine endpoints, all under one prefix. `/api/assistant/*` is deliberately **outside**
both initiative prefixes: the SAP pop-up knows a material and a plant and cannot
know which initiative owns it — that is the thing the router decides.

| Method | Path | Notes for the UI |
| --- | --- | --- |
| POST | `/api/assistant/sessions` | Open. Returns `routing` always; `sessionId`/`step` only when a session was minted. |
| POST | `/api/assistant/sessions/{id}/turns` | Answer the current step, get the next. **201**, not 200. |
| GET | `/api/assistant/sessions/{id}` | Full trace: advice as served, turns, plans, suggestions, justifications. |
| GET | `/api/assistant/sessions` | The session log. |
| POST | `/api/assistant/ask` | Free-text box, fixed intent set, no AI. |
| GET | `/api/assistant/ask/suggestions` | The chips. Served, not hard-coded. |
| POST/GET | `/api/justifications` | Shared by both initiatives. |
| ~~POST/GET~~ | ~~`/api/i13/consumption-plans`~~ | **Unreachable — 404. See §3.3.** |
| GET | `/api/i13/quantity-suggestion`, `/api/i8/repairable-unit` | FR-3 and FR-6 standalone. Both mounted and reachable. |

### 3.1 Five contract facts that will cost a day each if missed

**1. Two casing conventions in one API.** `/api/assistant/*`, `/api/i8/*` and
`/api/i13/consumption-plans` + `/api/i13/quantity-suggestion` serve **camelCase**
(pydantic `alias_generator=to_camel`). Every other `/api/i13/*` route serves
**snake_case**, which is why `features/initiative-13/api/client.ts` hand-maps every
field. A new assistant client must not copy that mapper — the assistant routes
need no mapping. Mixing the two is the most likely source of silent `undefined`.

**2. Quantities are strings, and must stay strings.** The backend says so in
`app/api/assistant/schemas.py`: a Decimal through a JSON number returns `2.1` as
`2.0999999999999996`, and these values land in an append-only table a compliance
engine reads. `plannedQuantity`, `suggestedQuantity`, `monthsOfCover`,
`stockOnHand` — all strings. Format for display; never round-trip through
`Number()`.

**3. `facts` is untyped on the wire** (`dict[str, Any]`), and its shape differs by
flow. I08 facts carry `repairableUnitExists`, `openRepairLines`, `soonestDueDate`,
`overdueLines`, `repairDueDateIsReliable`, `waitingBeatsBuying`. I13 facts carry
`monthsOfCover`, `agingBand`, `crossPlantStock[]`, `grNotIssuedFlag`,
`acquiredVsPlanStatus`. Both carry `flow`, `headline`, `caveats[]`,
`referenceDate`. The frontend must define a **discriminated union on
`facts.flow`** and validate at the boundary — this is the one place the backend's
types do not reach us.

**4. "No session" is a 200, not an error.** A consumable routes to `flow: "none"`
with `sessionId: null` and `step: null`. Rendering that as a failure would be
wrong: the assistant genuinely has no opinion, and `routing.reason` is the
sentence to show. A real data gap (an OAR part WATCH has never seen) is a **422**
with a `detail` string, and that is a different screen again.

**5. Identity comes from a header, and today three different placeholders exist.**
`get_current_actor` reads `X-Actor-Id` and defaults to `"unknown-actor"`. The I08
attestation path (`app/api/i8/router.py:133`) ignores the header entirely and
hardcodes `"UNAUTHENTICATED_LOCAL_USER"`. `app/assistant/session.py:79` defines a
third route to that same constant. `lib/api/client.ts` sends **no actor header at
all** today. Unless the frontend sends one from day one, append-only audit rows
will carry two or three different names for the same unauthenticated person, and
they cannot be corrected afterwards. See §9, O-1.

**6. `detail` on a 4xx is sometimes a string and sometimes an array.** Verified against a
`TestClient` run of the real app. A pydantic validation failure returns
`detail: [{type, loc, msg, input, ctx}, …]`; an application-raised `HTTPException`
returns `detail: "quantity must be a number, got 'abc'"`. Both are 422. A renderer
that assumes a string prints `[object Object]` on the commonest failure there is —
a required field left empty. The error type must model both arms.

**7. Field `name`s are snake_case inside a camelCase envelope.** The step model is
camelCase (`helpText`, `sessionId`), but the `name` of each field — the key the
answer must be posted under — is `planned_quantity`, `window_start`,
`reason_category`, `free_text`. They are data keys, not model fields, so the alias
generator never touches them. Verified in the generated fixtures.

### 3.2 The step machine, as it actually is

Four step kinds — `message`, `choice`, `form`, `terminal` — and five field types —
`text`, `textarea`, `number`, `date`, `select`.

```
I08:  assessment (choice) ─ use_existing ──────────────────► done (terminal)
                          └ proceed_new ──► justification (form) ──► done

I13:  assessment (choice) ─ not_needed ───────────────────► done
                          └ proceed ──► capture_plan (form)
                                          ├─ no suggestion possible ─► done
                                          ├─ no override ────────────► done
                                          └─ override ─► quantity (choice)
                                                          ├ accept ──► done
                                                          └ keep ──► justification (form) ─► done
```

Every terminal step's `prompt` already contains the sentence telling the planner to
type the reference into SAP. **Do not rewrite it in the UI** — it is the compliance
instruction, and it is served so it can be changed in one place.

Shortest path is two turns; longest is four. Depth is bounded, so no pagination or
virtualisation is needed in the transcript.

### 3.3 A backend defect found while pinning this contract

`POST /api/i13/consumption-plans` and `GET /api/i13/consumption-plans` **return 404.**
`app/api/i13/routes.py:15` imports the module as `assistant_routes` and then never calls
`router.include_router(assistant_routes.router)` — a grep for `assistant_routes` across the
whole backend returns that single import and nothing else. Confirmed empirically against a
`TestClient`: 404 on both verbs, while `/api/i13/quantity-suggestion`, `/api/i8/repairable-unit`
and `/api/justifications` all return 500 on the same run, which is the no-database error and
therefore proof that those three routes exist.

**What still works.** Plan capture through the conversation is unaffected — the turn service
writes the `consumption_plan` row when the form step is answered, and the row is readable
through `GET /api/assistant/sessions/{id}` in `plans[]`. Only the standalone REST surface is
missing.

**What changes in this plan.** Phase 2's exit criterion and §10's key assertion both read the
captured plan back through the session trace instead. Phase 4's "direct plan capture outside a
conversation" is dropped — there is nothing to call. The fix is one line in the backend repo
and is raised as ask O-7; this plan does not make it, because it is not this repo.

---

## 4. Seven decisions to take before Phase 1

Each has a recommendation. All are cheap to reverse except D-2.

**D-1 — New route namespace, or reuse `/chat`?**
*Recommend: new `/assistant/*`, retire `/chat` at the end of Phase 5.* The mock
chat is referenced by the sidebar session list, `lib/mock-data.ts` and three
routes. Migrating it in place leaves a half-real screen live for several days,
which is exactly the confusion `dataset-mode.ts` exists to prevent. A clean
namespace lets both run side by side during review and lets `/chat` be deleted in
one commit.

**D-2 — Where does the session reference live in the UI?**
*Recommend: a persistent, copyable banner from the moment the session is minted,
not only on the terminal step.* A planner who closes the tab mid-conversation has
still had a session minted against their name, and the reference is the only thing
linking it to the reservation they are about to save. **Hard to reverse in
practice** — if the first demo trains people to look for it at the end, that is
where they will look.

**D-3 — Client component or server component?**
*Recommend: client, unlike every other backed screen in this repo.* The assistant
is a POST-driven state machine with an actor header; server components buy nothing
here. Keep the existing `useI13Query` shape for the read-only session log and trace
views so those match the rest of the app.

**D-4 — Optimistic rendering of the user's answer?**
*Recommend: yes for the echo bubble, no for anything derived from it.* Show the
chosen label immediately, but do not synthesise the next step. The whole point of
the server-driven design is that the browser does not know what comes next.

**D-5 — What does the free-text box do during a conversation?**
*Recommend: disable it inside an open session; offer it on the landing screen and
the session log.* `/api/assistant/ask` is a separate, stateless intent matcher
that writes nothing. Putting it in the same input as a turn answer would make an
unrecorded answer look recorded.

**D-6 — Does the frontend validate form fields?**
*Recommend: required-checks only, mirroring the `required` flag the step carries;
everything else is the server's 422 rendered inline.* `app/assistant/turns.validate`
is the only code that knows what was asked. A second validator in TypeScript is the
drift the server-driven design was chosen to avoid.

**D-7 — Deep-link URL shape, which the SAP BAdI will eventually call.**
*Recommend fixing it now and writing it into the W2.8 contract note:*
`/assistant/new?material={MATNR}&plant={WERKS}&quantity={MENGE}&origin=BADI`.
`quantity` optional — the pop-up may fire before one is entered, and a defaulted
zero is indistinguishable from a real one (the backend already makes this
distinction; the URL must not undo it).

---

## 5. The phases

Estimates assume one frontend developer. **Phases 0–3 are what W7.5 means by
"assistant user interface … and the deep-link entry point"** and are what the
25-Sep dev-complete line needs. Phases 4–6 follow it.

---

### Phase 0 — Contract foundation *(~0.5 day)*

Nothing renders. This phase exists because every bug in §3.1 is cheaper to prevent
than to find in a demo.

**Tasks**
1. Extend `lib/api/client.ts`: an `apiPost` helper; parse FastAPI's `{"detail": …}`
   into `ApiError.detail` so a 422 can be shown to the user verbatim; inject
   `X-Actor-Id` on every request from one place.
2. Add `lib/api/actor.ts` — the single source of the current actor id, reading an
   env var today and an Entra claim later. One function, one import site.
3. New `lib/api/assistant.ts`: types mirroring `app/api/assistant/schemas.py`
   one-for-one, camelCase, **quantities typed as `string`**, plus the nine typed
   functions.
4. Discriminated `AssistantFacts` union on `facts.flow`, with a narrowing guard and
   an explicit "unknown flow" fallback that renders the headline and nothing else.
5. Capture three real payloads from a running backend (an I08 session, an I13
   session with an override, an out-of-scope material) into
   `lib/api/__fixtures__/` and assert the types against them in a vitest test.

**Exit:** `npm run test` green; the fixtures are real backend output, not written
by hand.

**Risk retired:** every one in §3.1.

---

### Phase 1 — The conversation *(~1.5 days)*

The core of W7.5. Both flows, end to end, against the real backend.

**Tasks**
1. Routes: `/assistant/new` (reads the deep-link query per D-7, POSTs
   `/sessions`, redirects to the minted id) and `/assistant/[sessionId]`.
2. `components/assistant/assistant-workspace.tsx` — the state machine holder. State
   is: the transcript so far, the current step, and in-flight/error. **No cursor.**
3. Four step renderers:
   - `message` — prompt only.
   - `choice` — reuse `option-card.tsx` / `option-group.tsx`; `description`
     under each label; lock once answered.
   - `form` — Phase 2's field renderer.
   - `terminal` — the prompt verbatim, plus the reference treated as the
     payload (D-2).
4. The **assessment card** above the question, rendered from `facts` per flow —
   this is FR-5(a) for I08 and FR-2(a) for I13, and it is the part a planner
   actually reads. I08: repair status, vendor, expected arrival, overdue state.
   I13: stock on hand, open POs, months of cover, moving class, cross-plant stock.
5. The **footnote** rendered under the question, never folded into it. The caveats
   are where "this due date is 515 days old and is no longer a forecast" lives.
6. The three non-happy paths, each as its own rendering:
   - `flow: "none"` → `routing.reason`, plus a link back. Not an error state.
   - 422 on open → the `detail` sentence (a real data gap).
   - 404 on a turn → "this reference was never issued, or was mistyped" —
     the backend distinguishes these and the copy should too.
7. Session-reference banner (D-2) with copy-to-clipboard and a `sonner` toast.

**Exit:** a planner can complete both flows in the browser against a local
backend, and `GET /api/assistant/sessions/{id}` shows the turns they took.

---

### Phase 2 — Form rendering and answers *(~1 day)*

**Tasks**
1. `components/assistant/step-form.tsx` — one renderer driven by `fields[]`, one
   input component per field type. The reason-category `select` is built from
   configuration on the backend, so the UI must never hold a hard-coded list.
2. `default` honoured (the plan form pre-fills the planned quantity from the
   requested quantity — as a **string**).
3. `helpText` rendered, not swallowed. It carries real instruction ("leave blank if
   you genuinely do not know yet"), and dropping it changes what gets captured.
4. Required-only client validation (D-6); 422 `detail` rendered against the form.
5. Double-submit guard. The turns table is append-only; a duplicate POST is a
   permanent duplicate row.
6. The date-window pair (`window_start` / `window_end`) rendered as a pair, with
   end-before-start caught client-side.

**Exit:** consumption plan and both justification forms capture correctly; a
captured plan is visible in `plans[]` on `GET /api/assistant/sessions/{id}`
(**not** via `/api/i13/consumption-plans`, which 404s — see §3.3).

---

### Phase 3 — Session log and session trace *(~1 day)*

This is the surface FR-8 acceptance is read from, and the honest place to show
what is blocked.

**Tasks**
1. `/assistant/sessions` — the log. Columns: reference, flow, outcome, material,
   plant, requester, origin, issued, turns. Filter by flow and outcome.
2. `/assistant/sessions/[id]` — the trace. **The advice as served**, replayed from
   the stored assessment rather than recomputed (the register and the stock both
   move; recomputing answers a different question). Then turns, plans, quantity
   suggestions, justifications.
3. Render `linkageNote` and `expired` prominently. Expiry is **reported and never
   enforced** — the reservation is already in SAP and we cannot write back, so
   treating an expired reference as non-compliant would raise an exception nobody
   could ever clear.
4. A standing, visible statement that the reservation link is blocked on `Bednr`
   (blocker B2), on the trace itself rather than in a footnote somewhere. Every
   session says so today; the UI should not quietly drop it.

**Exit:** the FR-8 demo can be given from the UI: one reference, everything it
produced, and an explicit statement of the one link that is missing and why.

---

### Phase 4 — Free-text ask, and the justification record *(~1 day)*

**Tasks**
1. Ask box on the landing screen: chips from `GET /ask/suggestions` — **served, not
   hard-coded**, so the UI cannot offer a question the backend has stopped
   answering. Render `answered: false` as the plain sentence plus the list of what
   it can do, never as an error or an empty result.
2. Render `sources[]` under every answered response. No model is involved in this
   path and the UI should be able to prove it.
3. Wire `GET /api/justifications` into the I13 Utilisation Dashboard's Justification
   Log, which today reads **only** ACT exception confirmations via
   `getI13Justifications` — two list calls plus up to 30 detail fetches, capped,
   and structurally blind to every justification the assistant captures
   (`NEW_ACQUISITION`, `QUANTITY_OVERRIDE`). Show both sources, labelled by `kind`.
4. Surface the same record on the I08 side, which has no justification view at all
   today. I08 FR-7 requires it on the dashboard and in the exception queue.

**Exit:** a justification captured in the chat appears in both dashboards within
one refresh, labelled with where it came from.

---

### Phase 5 — Entry points, and retiring the mock *(~1 day)*

**Tasks**
1. "Ask the assistant" entry from: a Materials row, the Material 360 drawer, an I08
   register line, an I13 WATCH row. Each passes material + plant, and quantity
   where it genuinely has one.
2. Sidebar: an Assistant section via a manifest, matching how I07/I08/I13 register
   their nav (`features/*/manifest.ts`). No hand-edit of `lib/constants.ts`.
3. Write the deep-link contract note for W2.8 — the URL the BAdI pop-up opens, its
   parameters, and what happens when each is absent. **This is a deliverable for
   the SAP team, not just for us.**
4. Delete `/chat`, `chat-workspace.tsx`, and the session fixtures in
   `lib/mock-data.ts` that only it read. Keep the presentational chat components.
5. `lib/material-router.ts` classifies materials **in the browser** for the mock.
   `POST /api/assistant/sessions` now answers the same question authoritatively,
   from the same config the backend uses everywhere else. Retire the browser copy
   wherever the routing decision is recorded; leave it only where a synchronous
   guess is genuinely all that is needed (see §8, R-3).

**Exit:** no screen plays a scripted conversation; one classification authority for
anything that gets written down.

---

### Phase 6 — Compliance surfaces and polish *(~1 day, partly blocked)*

**Tasks**
1. Exception states from the assistant's own records where the backend exposes
   them: no-plan, unjustified acquisition. **Missing-session cannot be built** —
   it requires reading the reference back off a reservation, which needs `Bednr`
   on `ReservationItemSet` (B2). Show the state as *blocked*, not as *zero*. Zero
   reads as compliance; blocked reads as unknown, which is the truth.
2. Empty, loading and error states across all new screens, matching
   `components/shared/empty-state.tsx`.
3. Export on the session log, matching the CSV pattern the I13 dashboard uses.
4. Accessibility pass: the transcript is a live region; the reference banner is announced
   when it appears. Dark mode via the existing tokens.

   **Revised during Phase 2 — choices stay buttons.** This plan originally called for
   radio-group semantics. That is wrong for this interaction. A radio group moves selection
   with the arrow keys, and because a choice here *is* the answer — there is no confirm step,
   deliberately — arrowing through the options would submit whichever one the user landed on
   first. The two options are actions ("use the existing unit" / "buy a new one and say
   why"), not a set to pick among and confirm later, and `<button>` is the correct role for
   an action. Buttons are already reachable by Tab and activated by Enter or Space, and they
   are grouped and labelled. No `RadioGroup` primitive is added.
5. A visible "demo data" marker wherever fabricated consumption plans are still in
   view (§7).

---

## 6. FRS coverage after this plan

**Initiative 08**

| FR | What it needs from the frontend | Phase | After this plan |
| --- | --- | --- | --- |
| FR-1 Repairable universe | — (backend read model) | — | Already served |
| FR-2 Coding candidates | Screen exists, live | — | Done |
| FR-3 Repair status register | Screen exists, live | — | Done |
| FR-4 Attestation | Declaration Queue exists, live | — | Done; evidence upload descoped at W5.3 |
| FR-5 Reservation assistant | The conversation, I08 flow | 1–2 | **Done** |
| FR-6 Repairable-unit-exists | Assessment card + standalone check | 1, 5 | **Done** |
| FR-7 Justification capture | Form + dashboard surface | 2, 4 | **Done** |
| FR-8 Session traceability | Trace view; link-back blocked | 3, 6 | **Partial — blocked on B2 / `Bednr`** |
| FR-9 Overdue and aging | Register has it | — | Done |
| FR-10 Dashboard and reporting | I08 Overview is still fixture-backed | — | **Gap — not in this plan** |
| FR-11 Notifications | Email out of scope in the plan; queue only | 6 | Partial |

**Initiative 13**

| FR | What it needs from the frontend | Phase | After this plan |
| --- | --- | --- | --- |
| FR-1 OAR demand context | WATCH screen, live | — | Done |
| FR-2 Reservation assistant | The conversation, I13 flow | 1–2 | **Done** |
| FR-3 Quantity suggestion | Suggestion step + reason + override | 1–2 | **Done** |
| FR-4 Plan record + traceability | Plan form; link-back blocked | 2–3 | **Partial — blocked on B2** |
| FR-5 STITCH ledger | Ledger screen, live | — | Done |
| FR-6 WATCH metrics | Screens live | — | Done |
| FR-7 Plan breach / no-plan | Aging Exceptions live; justification wiring | 4 | **Done** |
| FR-8 Reclassification evidence | Screen live | — | Done |
| FR-9 ACT queue and escalation | Screen live | — | Done |
| FR-10 Dashboard and reporting | Live; justification log incomplete | 4 | **Done** |
| FR-11 Notifications | Queue only, email out of scope in the plan | 6 | Partial |

Two things this plan deliberately does **not** close: I08 FR-10 (the I08 Overview is
still fixture-backed and has no backend behind it) and the BAdI-triggered path
(W7.7, which follows the SAP transport and may fall after 25-Sep). Both are named
dependencies to chase, not descopes.

---

## 7. What will look wrong in the demo, and is not

Carried forward from the backend notes, because these become visible for the first
time when there is a UI.

- **Most repair due dates are in the past.** 695 of 788 open repair lines are
  overdue in the frozen July 2026 extract. The assistant correctly refuses to say
  "wait for the repair" on those, and says the date is no longer a forecast.
- **Every consumption plan on screen is fabricated** until somebody captures one
  through the chat. 742 rows came from a generator, with invented `SESS-000001`
  references. Plans carry `source = CAPTURED | REFERENCE_CSV`; the UI must show it.
  Say this out loud before demoing the exception queue.
- **The assistant never says "the vendor has it."** Zero open repair lines carry a
  dispatch movement, so no line can be confirmed as physically with the vendor.
- **Almost every material gets a flow.** ND + PD is 97.8% of the seeded extract,
  and 97.6% of 80-series rows are also OAR. I08 wins the tie and the losing match
  is recorded on the session. Expect the assistant to have an opinion about nearly
  everything — that is the config, not a bug (open question 14 to VZI).
- **Every session is issued to an unauthenticated placeholder** until Entra lands.
  Visible on purpose rather than hidden behind a blank field.

---

## 8. Risks

**R-1 — The 25-Sep line.** Three working days remain and Phases 0–3 are roughly
four days of work. The honest read is that W7.5 lands on or just after the line,
and W7.6's frontend half lands after it. *Mitigation:* Phases 0–2 alone give a
demonstrable assistant; Phase 3 is what makes FR-8 reviewable. Cut Phase 4 before
cutting Phase 3.

**R-2 — Two casing conventions in one API.** See §3.1. *Mitigation:* Phase 0's
fixture tests, which fail loudly rather than rendering an empty card.

**R-3 — Two classification authorities.** `lib/material-scope/` and
`lib/material-router.ts` decide OAR-ness in the browser; the backend decides it
again from its own config. They already disagree — this repo's own CPI scan found
ND + PD at 46.4% of a 2,183-row sample, the backend's seeded 45,409-row extract
puts it at 97.8%. Different populations, but a screen showing both numbers will be
asked which is right. *Mitigation:* Phase 5, task 5 — one authority for any
decision that is recorded.

**R-4 — Append-only writes from a browser.** Every POST is permanent. A retry after
a timeout writes a second row that cannot be deleted. *Mitigation:* Phase 2's
double-submit guard, and no automatic retry on any non-GET request.

**R-5 — `facts` is untyped.** A backend field rename breaks a card silently.
*Mitigation:* narrow at the boundary, fixture tests, and a fallback that renders
the headline rather than an empty card.

---

## 9. Open questions

Owner in bold. Nothing here blocks Phase 0 or Phase 1.

- **O-1 (backend / us).** Three unauthenticated identity placeholders exist across
  append-only tables — `unknown-actor` from `get_current_actor`,
  `UNAUTHENTICATED_LOCAL_USER` via the assistant's own default, and the same
  constant hardcoded in the I08 attestation route, which ignores `X-Actor-Id`
  entirely. Settle on one before the frontend writes a single row, because these
  rows cannot be corrected.
- **O-2 (VZI).** Justification reason categories. Seven placeholders are configured;
  VZI's own list is needed. It is configuration, so it is an `.env` change — but
  the demo shows the placeholders until it arrives.
- **O-3 (VZI).** Session validity window, defaulted to 72 hours, reported and never
  enforced. Confirm that reporting-only is the intent.
- **O-4 (Zensar / VZI).** Sign-off on the deterministic-core deviation. Both FRSs
  say the assistant's responses are "generated through the provider-agnostic LLM
  layer"; the built assistant computes every number and the narrative layer is off
  by default (`ASSISTANT_NARRATIVE_ENABLED=false`). If the narrative is switched
  on, the UI needs a place for it — decide before Phase 1 renders the headline.
- **O-5 (SAP team, via W2.8).** The deep-link URL per D-7, and the designated
  reservation field. `Bednr` on `ReservationItemSet` is blocker B2 and gates the
  second half of I08 FR-8 and I13 FR-4.
- **O-6 (VZI).** Is the OAR rule right, given it selects 97.8% of the seeded
  catalogue? Open question 14, and it decides how often the plan form appears.
- **O-8 (backend).** **A conversation cannot be resumed.** There is no endpoint that returns
  the current step of an existing session: `GET /api/assistant/sessions/{id}` serves the trace
  (turns, plans, suggestions, justifications) but no `step`, and the step is derived inside
  `next_step` from the answers so far. So a planner who reloads mid-conversation loses the UI
  and cannot continue — the session and every turn are safely recorded, but the only ways
  forward are to read the trace or to open a *second* session, which writes another row into
  an append-only table for one decision. Either `GET /sessions/{id}` gains a `currentStep`, or
  a `GET /sessions/{id}/step` is added. Cheap on the backend, and it removes the only way a
  planner can accidentally create a duplicate session.
- **O-7 (backend).** `assistant_routes.router` is imported in `app/api/i13/routes.py:15` and
  never mounted, so both `/api/i13/consumption-plans` verbs 404 (§3.3). One line fixes it.
  Until it lands there is no way to read or write a consumption plan outside a conversation,
  and no way for a future no-plan remediation screen to capture one against an existing
  reservation. Not urgent for W7.5; blocking for anything that captures a plan after the fact.

---

## 10. Test plan

- **Unit (vitest, already configured).** `vitest.config.mts` is `environment: "node"` with
  `include: ["src/**/*.test.ts"]` — no jsdom, no testing-library, and all nine existing test
  files test pure functions. Component tests are therefore not possible without adding three
  devDeps and changing shared config. Instead the logic comes **out** of the JSX into pure
  modules and those are tested: the `facts` type guards, the answer-payload builder, the
  required-field validator, the transcript reducer, the two-armed error parser, and
  quantity-as-string round-trips. This matches how the repo already tests and adds no
  dependency.
- **Fixture tests.** The three captured payloads from Phase 0, asserted against the
  types. These are the regression net for a backend schema change.
- **Integration, manual, against a local backend.** Both flows end to end; both
  terminal paths of each; an out-of-scope material; a mistyped reference (the
  check character should reject it immediately); a material with no WATCH row (the
  422).
- **The one assertion worth writing explicitly:** a plan captured through the UI
  comes back in `plans[]` on `GET /api/assistant/sessions/{id}` with `status = OPEN`
  and a null `reservationNumber`. The backend has a test asserting
  the reservation number is still empty; when B2 lands, that test fails, and that
  is the moment to extend this one too.

---

## Appendix — file inventory for the new work

```
src/app/assistant/
  new/page.tsx                       # deep-link entry (D-7)
  [sessionId]/page.tsx               # the conversation
  sessions/page.tsx                  # the log
  sessions/[id]/page.tsx             # the trace
src/components/assistant/
  assistant-workspace.tsx            # state holder; no cursor
  step-renderer.tsx                  # message | choice | form | terminal
  step-form.tsx                      # five field types
  assessment-card.tsx                # facts, per flow
  session-reference.tsx              # the 10-character payload (D-2)
  routing-notice.tsx                 # flow: "none"
  ask-box.tsx                        # free text (Phase 4)
src/features/assistant/
  manifest.ts                        # sidebar registration
src/lib/api/
  assistant.ts                       # typed client, camelCase
  actor.ts                           # one actor id
  __fixtures__/                      # real captured payloads
```

Reused unchanged: `components/chat/chat-message.tsx`, `option-card.tsx`,
`option-group.tsx`, `chat-body.tsx`, `components/shared/*`.
Deleted in Phase 5: `components/chat/chat-workspace.tsx`, `src/app/chat/*`, and the
session fixtures in `lib/mock-data.ts` that only it read.
