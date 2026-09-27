# Assistant wire fixtures

**These are generated, not written.** Do not hand-edit a `.json` file here.

`gen_fixtures.py` builds real `I08Assessment` and `I13Assessment` objects, walks
them through `app/assistant/script.py::next_step`, and serialises each step
through the router's own `_step_model` / `_routing_model` / `_plan_model` /
`_suggestion_model` / `_justification_model` with
`model_dump(by_alias=True, mode="json")`. What lands in these files is byte-for-byte
what the HTTP layer emits.

No database is involved. The assistant's script and both assessments are pure
functions over data the caller supplies, which is also why the backend's own
`tests/assistant` suite runs without Postgres.

## Regenerating

From the backend repo root, with its venv:

```bash
cd ../Init-7-8-13-Backend
./.venv/Scripts/python.exe \
  ../Init-7-8-13-Frontend/src/lib/api/__fixtures__/gen_fixtures.py
```

The script writes into whatever `OUT` is set to at its top — point that at this
directory. Re-run it after any backend change to `schemas.py`, `script.py` or
either `reservation_assistant.py`, then run `npm run test` here. If
`assistant-types.test.ts` starts failing, the contract moved and
`lib/api/assistant.ts` or `lib/api/assistant-facts.ts` needs to follow it.

## What each file is

| File | Scenario |
| --- | --- |
| `01-start-i08-choice` | I08 open, one open repair, already overdue |
| `02-start-i08-two-open-repairs` | two lines, one vendor unnamed (supplier-master gap) |
| `03-start-i08-nothing-to-challenge` | no repairable unit — terminal on the first step |
| `04-start-i13-choice` | I13 open, slow-moving, cross-plant stock, GR-not-issued |
| `05-start-out-of-scope` | `flow: "none"` — a 200 with a null session |
| `06`–`08` | the I08 branches: use existing / proceed new / justify |
| `09`–`15` | the I13 branches, including the quantity override and its justification |
| `16`, `17` | full session traces, I13 and I08 |

## Why they are checked in

The types in `lib/api/assistant.ts` are hand-maintained against a Python
codebase this repo cannot import, and `StepModel.facts` is `dict[str, Any]`, so
FastAPI publishes no schema for the most detail-heavy part of the payload.
These files plus `assistant-types.test.ts` are the only thing standing between a
backend rename and a screen of `undefined`.
