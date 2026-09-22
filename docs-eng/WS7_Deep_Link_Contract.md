# Reservation assistant — deep-link contract

**For:** the SAP team and NTT, building the reservation-entry BAdI (W2.8, W7.7)
**From:** Zensar AI team
**Date:** 22 September 2026
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
    &quantity={BDMNG}
    &origin=BADI
```

| Parameter | Source | Required | Notes |
| --- | --- | --- | --- |
| `material` | `RESB-MATNR` | **yes** | As held in SAP. Leading zeros are fine — the platform normalises them. |
| `plant` | `RESB-WERKS` | **yes** | `1300` or `1500`. See "Plant is not optional" below. |
| `quantity` | `RESB-BDMNG` | no | Requirement quantity, if one has been entered. See "Quantity" below. |
| `origin` | fixed literal | no | Send `BADI`. Defaults to `PLATFORM`. |

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

## Quantity: please send nothing rather than zero

If the pop-up fires before the requester has entered a quantity, **omit the
parameter entirely**. Do not send `quantity=0`.

The platform distinguishes "no quantity was stated" from "a quantity of zero was
requested", and they drive different behaviour: the quantity suggestion (I13 FR-3)
compares what was asked for against the trailing-twelve-month consumption rate, and
a zero is a real request for none rather than an absence of information. A defaulted
zero would be recorded as a stated intent nobody had.

A non-numeric quantity is rejected before any session is opened, and the page says
the link is malformed rather than blaming the platform's data.

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
3. Confirm the pop-up can pass all four parameters, and that it can omit `quantity`
   rather than defaulting it to zero.
4. Confirm one BAdI serves both initiatives by sending every line to this URL,
   rather than routing on material category in ABAP.

## Questions for VZI

5. Session validity window — defaulted to 72 hours. Currently **reported and never
   enforced**: the reservation is already in SAP and the platform cannot write back,
   so treating an expired reference as non-compliant would raise an exception nobody
   could clear. Confirm reporting-only is the intent.
6. The justification reason categories. Seven placeholders are configured; VZI's own
   list is needed. It is an `.env` change, not a release.
