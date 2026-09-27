# Reservation assistant — deep-link contract

**For:** the SAP team and NTT, building the reservation-entry BAdI (W2.8, W7.7)
**From:** Zensar AI team
**Date:** 23 September 2026 (supersedes 22 September — `quantity` is gone, two parameters are new)
**Status:** proposed — the platform side is built and live at this URL; the SAP side is not

---

## What this document is for

The reservation-entry BAdI shows a pop-up before a reservation is saved and sends
the requester to the AI assistant. This is the URL it opens and what each parameter
means. **Nothing here needs a platform change to start using** — the endpoint is
live and the page works today, which is what makes the assistant demonstrable
independently of the SAP transport.

---

## The URL

```
https://<platform-host>/assistant/new
    ?material={MATNR}
    &plant={WERKS}
    &department={KOSTL or equivalent}
    &requestedFor={name}
    &origin=BADI
```

| Parameter | Source | Required | Notes |
| --- | --- | --- | --- |
| `material` | `RESB-MATNR` | **yes** | As held in SAP. Leading zeros are fine — the platform normalises them. |
| `plant` | `RESB-WERKS` | **yes** | `1300` or `1500`. See "Plant is not optional" below. |
| `department` | whatever the pop-up can reach | no | Which department the part is for. Max 64 characters. See "The two new parameters" below. |
| `requestedFor` | whatever the pop-up can reach | no | The name of the person the part is for. Max 128 characters. |
| `origin` | fixed literal | no | Send `BADI`. Defaults to `PLATFORM`. |

**`quantity` has been removed.** It was in the 22 September version of this
document. A link that still sends it is accepted and the parameter is ignored,
so nothing breaks — but please drop it. The reason is in "Why quantity went
away" below.

A minimal, valid call:

```
/assistant/new?material=8000005632&plant=1300&origin=BADI
```

---

## Plant is not optional

Stock on hand, open repair lines, months of cover and cross-plant availability are
**all held per plant**. The same material at 1300 and at 1500 gets different advice,
and frequently opposite advice — one site may hold three on the shelf while the
other has none and two on repair order.

A link with a material and no plant cannot be answered. The page says so rather than
picking a site, because answering confidently for the wrong one is worse than
asking.

---

## The two new parameters

On site, one coordinator runs the assistant for everybody. They are not the
person who wants the part, so the platform records two different things:

- **who operated the assistant** — taken from the signed-in session, never from
  the URL, and not something the BAdI can set; and
- **who the part is for** — `requestedFor`, a plain name.

`requestedFor` is deliberately **not** treated as an identity. Nobody verifies
it, and no permission or approval depends on it. It is a property of the
reservation, like the material number, which is why it is safe to put in a URL.
Send whatever the pop-up can reach — a user id, a full name, whatever the site
actually uses.

`department` is the requester's department, not the coordinator's. Free text on
our side: nothing the platform loads maps a person to a cost-bearing department,
so we do not validate it against a list.

**Both are optional, and we do not expect the pop-up to have them.** If the BAdI
can only reach a material and a plant, send those two and nothing else — the
platform records the blanks honestly rather than inventing values, and the person
at the screen is not asked for them again. If either *can* be reached, sending it
saves a step.

Please **omit** a parameter you have no value for rather than sending an empty
string.

---

## Why quantity went away

The assistant used to take a quantity on the link. It no longer does, and this
is not a simplification — it is a correction.

The quantity that matters is the one captured **inside** the conversation, against
a stated purpose and a date window. That is the figure the quantity suggestion
(I13 FR-3) works against and the figure compliance measures later (FR-7). Asking
for a second quantity at the door meant the same question twice, and the one
asked first — before the requester had thought about purpose or timing — was the
one that got the least thought.

Sessions created before this change keep the quantity they were given. The field
is still shown on those, because the record of what somebody was asked is not
rewritten when the question changes.

---

## What comes back, and what the requester must do

The assistant issues a **session reference** the moment it opens — for example
`SFDR49BSHH`. The requester types it into the reservation.

**Format:** `S` + 8 characters + 1 check character = **10 characters**, which is
what `Bednr` holds. The alphabet is Crockford base32, which omits `I`, `L`, `O` and
`U` so nothing is confusable; a typed `O` is silently read as `0`.

The check character is load-bearing. A mistyped reference fails immediately rather
than matching nothing — and "no session for this reservation" is the exact
compliance exception raised against somebody who skipped the assistant, so without
a checksum a typo becomes a false accusation against somebody who did everything
right.

**The reference is shown from the moment the session opens, not at the end.** A
requester who reads the advice and closes the window has still had a session
recorded, and both FRSs count "advice given, not acted on".

---

## Routing: one BAdI, and the platform decides

Send every reservation line the pop-up fires on. **Do not try to route by material
category in ABAP.** Working out whether a material is 80-series (Initiative 08) or
OAR (Initiative 13) is what the assistant does, and the rule is configuration on the
platform side so it can change without a transport.

Three outcomes, all handled by the same URL:

- **Repairable (I08)** — the requester is told whether a unit already exists.
- **Planned on demand (I13)** — stock, cover and cross-plant context, then the
  consumption plan.
- **Neither** — the page says the assistant has nothing to say about this part and
  the requester carries on. **No session is issued and there is no reference to
  enter.** This is a normal outcome, not an error, and the BAdI should not treat a
  missing reference on such a material as a failure.

Note for expectation-setting: on the current extract, 97.8% of material-plant rows
are OAR by MRP type and 97.6% of 80-series rows are *also* OAR. Initiative 08 wins
the tie. So in practice nearly every reservation the pop-up fires on will get a
flow — the third outcome will be rare.

---

## What the platform does NOT do

- **It does not write to SAP.** Not the reference, not the plan, not the
  justification. The requester types the reference in; the platform never does.
- **It does not block anything.** Every conversation reaches an end, no branch
  refuses to continue, and the requester can close the window and reserve whatever
  they like. What the platform does is record the reason when somebody goes ahead
  anyway.
- **It cannot read the reference back yet.** `Bednr` is not exposed on
  `ReservationItemSet` — see below.

---

## The one thing still blocking end-to-end traceability

`RESB-BEDNR` (requirement tracking number, `Edm.String(10)`) is **not in the
`ReservationItemSet` projection**. It is live on `PurchaseRequisitionSet` and
`PurchaseOrderItemSet` but absent here.

Until it is exposed, the platform cannot read the session reference back off a
reservation, so it cannot link reservation → session → plan/justification →
attestation → repair PR or PO. That is I08 FR-8 and the second half of I13 FR-4,
and it is the only part of the assistant that is blocked rather than built. Every
session trace states this on screen rather than leaving it to be inferred.

**The ten-character length is what fixes the reference format**, so please confirm
it before any reference is issued in anger — the format is hard to change
afterwards, because references land in an append-only table.

---

## Questions for the SAP team

1. Confirm `Bednr` can be added to the `ReservationItemSet` projection, and when.
2. Confirm the ten-character field length, since it fixes the reference format.
3. Confirm which parameters the pop-up can actually reach. `material` and `plant`
   are the only two we need. Tell us if `department` or a requester name is
   available — we will take them if they are and we will not hold anything up if
   they are not.
4. Confirm one BAdI serves both initiatives by sending every line to this URL,
   rather than routing on material category in ABAP.

## Questions for VZI

5. Session validity window — defaulted to 72 hours. Currently **reported and never
   enforced**: the reservation is already in SAP and the platform cannot write back,
   so treating an expired reference as non-compliant would raise an exception nobody
   could clear. Confirm reporting-only is the intent.
6. The justification reason categories. Seven placeholders are configured; VZI's own
   list is needed. It is an `.env` change, not a release.
