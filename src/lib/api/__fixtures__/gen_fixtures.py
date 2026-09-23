"""Generate REAL /api/assistant response payloads with no database.

Everything here goes through the production code:

* assessments from ``app.initiatives.i8.reservation_assistant.build`` and
  ``app.initiatives.i13.reservation_assistant.build`` (the same builders the
  backend's own tests use -- see tests/assistant/conftest.py);
* the conversation from ``app.assistant.script.next_step``;
* the quantity suggestion from ``app.initiatives.i13.quantity.suggest``;
* serialisation through the router's own ``_step_model`` / ``_routing_model`` /
  ``_plan_model`` / ``_suggestion_model`` / ``_justification_model`` and the
  real pydantic response models, dumped with ``by_alias=True, mode="json"``.

No JSON is hand-written. The only things invented are the scenario inputs
(the UniverseRow / RepairLine / WatchMetric values) and the identifiers and
timestamps, which in production come from the database.

Settings are NOT read: ``get_settings()`` cannot satisfy the assistant today
(nine fields the assistant code reads are absent from ``Settings``), so the
reason categories and the quantity config are passed explicitly, exactly as
tests/assistant/test_script.py does.
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

BACKEND = Path("C:/Users/varad/OneDrive/Desktop/newspares/Init-7-8-13-Backend")
sys.path.insert(0, str(BACKEND))

OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)

from app.api.assistant.router import (  # noqa: E402
    LINKAGE_NOTE,
    _justification_model,
    _plan_model,
    _routing_model,
    _step_model,
    _suggestion_model,
)
from app.api.assistant.schemas import (  # noqa: E402
    AnswerResponse,
    SessionTraceResponse,
    StartSessionResponse,
    TurnModel,
)
from app.assistant import script  # noqa: E402
from app.assistant.models import (  # noqa: E402
    ConsumptionPlanRecord,
    Justification,
    QuantitySuggestionRecord,
)
from app.assistant.router import Flow, RoutedFlow  # noqa: E402
from app.assistant.script import next_step  # noqa: E402
from app.initiatives.i13.act.domain import CrossPlantStockInfo  # noqa: E402
from app.initiatives.i13.models import AcquiredVsPlanStatus, AgingBand  # noqa: E402
from app.initiatives.i13.quantity import QuantitySuggestionConfig, suggest  # noqa: E402
from app.shared.material_scope import MaterialScope  # noqa: E402
from tests.assistant.conftest import (  # noqa: E402
    TODAY,
    i08_assessment,
    i13_assessment,
    repair_line,
    universe_row,
    watch_metric,
)

# --- the things a database would supply -----------------------------------

I08_SESSION = "S7K2M4P8Q1"
I13_SESSION = "SQ4X9B2T7M"
ISSUED_AT = datetime(2026, 7, 31, 9, 14, 22, tzinfo=timezone.utc)
EXPIRES_AT = datetime(2026, 8, 1, 9, 14, 22, tzinfo=timezone.utc)

CATEGORIES = ["URGENT_BREAKDOWN", "NO_SUITABLE_REPAIRABLE", "OTHER"]
QTY_CONFIG = QuantitySuggestionConfig(
    cover_ceiling_months=Decimal("12"),
    lookback_months=12,
    min_history_consumptions=3,
)


def write(name, model):
    payload = model.model_dump(by_alias=True, mode="json")
    path = OUT / name
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print("wrote " + path.name)


# --- I08 ------------------------------------------------------------------
#
# One OPEN repair line, already 61 days past its promised return date. That is
# the case the flow exists for and the one that populates the caveats.

OVERDUE = repair_line(due_date=date(2026, 5, 31), days_remaining=-61)
I08_OVERDUE = i08_assessment(lines=[OVERDUE])

# Two open lines, one overdue, one whose vendor is a code with no name: three
# caveats and a two-element openRepairs array.
I08_TWO_LINES = i08_assessment(
    lines=[
        OVERDUE,
        repair_line(
            purchasing_document="4500009876",
            item="00020",
            due_date=date(2026, 9, 15),
            vendor="0000100999",
            vendor_name=None,
            days_remaining=46,
        ),
    ]
)

# On the shelf, nothing on order: the unit EXISTS, so the assistant asks the
# question and renders a card -- but there is no due date to be reliable
# about, so repair_due_date_is_reliable is None rather than False. This is the
# third state, and the fixture exists so the contract test can pin it.
I08_STOCK_ONLY = i08_assessment(
    rows=[universe_row(stock_on_hand=Decimal("2"))], lines=[]
)

# Nothing in stock, no repair open: the flow terminates on its FIRST step.
I08_NOTHING = i08_assessment(rows=[universe_row(stock_on_hand=Decimal("0"))], lines=[])

I08_ROUTED = RoutedFlow(
    flow=Flow.I08,
    material_id="8000005632",
    plant="1300",
    eighty_series=True,
    material_scope=MaterialScope.OAR,
    mrp_type="ND",
    also_matched=Flow.I13,
)


def i08_step(answers, assessment=None):
    return next_step(
        flow=Flow.I08,
        session_id=I08_SESSION,
        assessment=assessment if assessment is not None else I08_OVERDUE,
        answers=answers,
        today=TODAY,
        reason_categories=CATEGORIES,
    )


# --- I13 ------------------------------------------------------------------
#
# 11 on hand, 1 a month, 12-month ceiling -> headroom 1, so a requested 5 is an
# OVERRIDE. Dormant (SLOW band), GRNI flagged, stock at another plant: all
# three I13 caveats populated.

I13_METRIC = watch_metric(
    stock_on_hand=Decimal("11"),
    open_po_quantity=Decimal("0"),
    average_monthly_consumption=Decimal("1"),
    months_of_cover=Decimal("11"),
    last_movement_date=date(2025, 5, 14),
    days_since_last_movement=443,
    last_issue_date=date(2025, 5, 14),
    days_since_last_issue=443,
    consumption_count_12m=12,
    consumed_qty_12m=Decimal("12"),
    aging_band=AgingBand.SLOW,
    gr_not_issued_flag=True,
    gr_not_issued_days_since_gr=58,
    gr_not_issued_relevant_gr_date=date(2026, 6, 3),
    gr_not_issued_received_quantity=Decimal("6"),
    gr_not_issued_issued_quantity=Decimal("0"),
    gr_not_issued_outstanding_quantity=Decimal("6"),
    acquired_vs_plan_status=AcquiredVsPlanStatus.NO_PLAN,
    calculated_at=datetime(2026, 7, 31, 6, 0, 0, tzinfo=timezone.utc),
)
I13_OVERRIDE = i13_assessment(
    metric=I13_METRIC,
    cross_plant=(
        CrossPlantStockInfo(
            material="1000000123", plant="1500", stock_on_hand=Decimal("2")
        ),
        CrossPlantStockInfo(
            material="1000000123", plant="1700", stock_on_hand=Decimal("0")
        ),
    ),
    requested=Decimal("5"),
)

# Same part, only one consumption in the window: no suggestion can be made.
I13_NO_HISTORY = i13_assessment(
    metric=watch_metric(
        stock_on_hand=Decimal("11"),
        average_monthly_consumption=Decimal("1"),
        months_of_cover=Decimal("11"),
        consumption_count_12m=1,
        consumed_qty_12m=Decimal("1"),
    ),
    requested=Decimal("5"),
)

I13_ROUTED = RoutedFlow(
    flow=Flow.I13,
    material_id="1000000123",
    plant="1300",
    eighty_series=False,
    material_scope=MaterialScope.OAR,
    mrp_type="ND",
    also_matched=None,
)

NONE_ROUTED = RoutedFlow(
    flow=Flow.NONE,
    material_id="2000000456",
    plant="1300",
    eighty_series=False,
    material_scope=MaterialScope.MIN_MAX,
    mrp_type="VB",
    also_matched=None,
)

PLANNED = Decimal("5")
SUGGESTION = suggest(I13_METRIC, PLANNED, QTY_CONFIG)
NO_SUGGESTION = suggest(I13_NO_HISTORY.metric, PLANNED, QTY_CONFIG)
assert SUGGESTION.is_override, "the I13 fixture must be an override"
assert not NO_SUGGESTION.available, "the no-history fixture must refuse"


def i13_step(answers, assessment=None, suggestion=None):
    return next_step(
        flow=Flow.I13,
        session_id=I13_SESSION,
        assessment=assessment if assessment is not None else I13_OVERRIDE,
        answers=answers,
        today=TODAY,
        reason_categories=CATEGORIES,
        suggestion=suggestion,
    )


PLAN_ANSWER = {
    "purpose": "Replacing the seal on mill 3 gearbox during the August shutdown.",
    "planned_quantity": "5",
    "window_start": "2026-08-10",
    "window_end": "2026-08-21",
    "cost_centre": "1300-MNT",
    "order_number": "4001234567",
}

JUSTIFY_QTY = {
    "reason_category": "URGENT_BREAKDOWN",
    "free_text": "Four spares go to the shutdown kit, one to the line.",
}
JUSTIFY_I08 = {
    "reason_category": "NO_SUITABLE_REPAIRABLE",
    "free_text": "Mill 3 is down and the repaired unit has no new date.",
}

# --- StartSessionResponse --------------------------------------------------

write(
    "01-start-i08-choice.json",
    StartSessionResponse(
        routing=_routing_model(I08_ROUTED),
        session_id=I08_SESSION,
        expires_at=EXPIRES_AT,
        step=_step_model(i08_step({})),
    ),
)

write(
    "02-start-i08-two-open-repairs.json",
    StartSessionResponse(
        routing=_routing_model(I08_ROUTED),
        session_id=I08_SESSION,
        expires_at=EXPIRES_AT,
        step=_step_model(i08_step({}, I08_TWO_LINES)),
    ),
)

write(
    "03-start-i08-nothing-to-challenge.json",
    StartSessionResponse(
        routing=_routing_model(I08_ROUTED),
        session_id=I08_SESSION,
        expires_at=EXPIRES_AT,
        step=_step_model(i08_step({}, I08_NOTHING)),
    ),
)

write(
    "18-start-i08-stock-only-no-due-date.json",
    StartSessionResponse(
        routing=_routing_model(I08_ROUTED),
        session_id=I08_SESSION,
        expires_at=EXPIRES_AT,
        step=_step_model(i08_step({}, I08_STOCK_ONLY)),
    ),
)

write(
    "04-start-i13-choice.json",
    StartSessionResponse(
        routing=_routing_model(I13_ROUTED),
        session_id=I13_SESSION,
        expires_at=EXPIRES_AT,
        step=_step_model(i13_step({})),
    ),
)

write(
    "05-start-out-of-scope.json",
    StartSessionResponse(routing=_routing_model(NONE_ROUTED)),
)

# --- AnswerResponse, I08 ---------------------------------------------------

write(
    "06-answer-i08-use-existing.json",
    AnswerResponse(
        session_id=I08_SESSION,
        step=_step_model(
            i08_step({script.I08_ASSESSMENT: {"choice": script.USE_EXISTING}})
        ),
    ),
)

write(
    "07-answer-i08-proceed-new.json",
    AnswerResponse(
        session_id=I08_SESSION,
        step=_step_model(
            i08_step({script.I08_ASSESSMENT: {"choice": script.PROCEED_NEW}})
        ),
    ),
)

write(
    "08-answer-i08-justification.json",
    AnswerResponse(
        session_id=I08_SESSION,
        step=_step_model(
            i08_step(
                {
                    script.I08_ASSESSMENT: {"choice": script.PROCEED_NEW},
                    script.I08_JUSTIFICATION: JUSTIFY_I08,
                }
            )
        ),
    ),
)

# --- AnswerResponse, I13 ---------------------------------------------------

write(
    "09-answer-i13-not-needed.json",
    AnswerResponse(
        session_id=I13_SESSION,
        step=_step_model(
            i13_step({script.I13_ASSESSMENT: {"choice": script.NOT_NEEDED}})
        ),
    ),
)

write(
    "10-answer-i13-proceed.json",
    AnswerResponse(
        session_id=I13_SESSION,
        step=_step_model(i13_step({script.I13_ASSESSMENT: {"choice": script.PROCEED}})),
    ),
)

AFTER_PLAN = {
    script.I13_ASSESSMENT: {"choice": script.PROCEED},
    script.I13_CAPTURE_PLAN: PLAN_ANSWER,
}

write(
    "11-answer-i13-capture-plan.json",
    AnswerResponse(
        session_id=I13_SESSION,
        step=_step_model(i13_step(AFTER_PLAN, suggestion=SUGGESTION)),
    ),
)

write(
    "12-answer-i13-accept-suggested.json",
    AnswerResponse(
        session_id=I13_SESSION,
        step=_step_model(
            i13_step(
                dict(AFTER_PLAN, **{script.I13_QUANTITY: {"choice": script.ACCEPT_SUGGESTED}}),
                suggestion=SUGGESTION,
            )
        ),
    ),
)

write(
    "13-answer-i13-keep-requested.json",
    AnswerResponse(
        session_id=I13_SESSION,
        step=_step_model(
            i13_step(
                dict(AFTER_PLAN, **{script.I13_QUANTITY: {"choice": script.KEEP_REQUESTED}}),
                suggestion=SUGGESTION,
            )
        ),
    ),
)

write(
    "14-answer-i13-quantity-justification.json",
    AnswerResponse(
        session_id=I13_SESSION,
        step=_step_model(
            i13_step(
                dict(
                    AFTER_PLAN,
                    **{
                        script.I13_QUANTITY: {"choice": script.KEEP_REQUESTED},
                        script.I13_QUANTITY_JUSTIFICATION: JUSTIFY_QTY,
                    }
                ),
                suggestion=SUGGESTION,
            )
        ),
    ),
)

write(
    "15-answer-i13-no-suggestion-possible.json",
    AnswerResponse(
        session_id=I13_SESSION,
        step=_step_model(
            i13_step(
                {
                    script.I13_ASSESSMENT: {"choice": script.PROCEED},
                    script.I13_CAPTURE_PLAN: PLAN_ANSWER,
                },
                assessment=I13_NO_HISTORY,
                suggestion=NO_SUGGESTION,
            )
        ),
    ),
)

# --- SessionTraceResponse --------------------------------------------------
#
# The turns are the real prompts, taken from the steps the script produced, and
# the answers are the normalised forms app.assistant.turns.validate stores. The
# plan / suggestion / justification are the real ORM rows app.assistant.turns
# writes, built in memory and passed through the router's own mapping.

#: Who OPERATED the assistant. One coordinator runs it for the whole site, so
#: this is the same on every session and no screen draws it -- it is carried
#: here because the trace is the FR-8 evidence view and an audit record without
#: its author is not one.
ACTOR = "MILLERJ"

#: Who the part is FOR, as the coordinator typed it. A different person from
#: ACTOR, deliberately: a fixture where the two matched would let a bug that
#: crossed the columns over pass unnoticed.
REQUESTED_FOR = "T. Mokoena"
DEPARTMENT = "Concentrator"

I13_TRACE_STEPS = [
    (i13_step({}), {"choice": script.PROCEED}),
    (i13_step({script.I13_ASSESSMENT: {"choice": script.PROCEED}}), PLAN_ANSWER),
    (i13_step(AFTER_PLAN, suggestion=SUGGESTION), {"choice": script.KEEP_REQUESTED}),
    (
        i13_step(
            dict(AFTER_PLAN, **{script.I13_QUANTITY: {"choice": script.KEEP_REQUESTED}}),
            suggestion=SUGGESTION,
        ),
        JUSTIFY_QTY,
    ),
    (
        i13_step(
            dict(
                AFTER_PLAN,
                **{
                    script.I13_QUANTITY: {"choice": script.KEEP_REQUESTED},
                    script.I13_QUANTITY_JUSTIFICATION: JUSTIFY_QTY,
                }
            ),
            suggestion=SUGGESTION,
        ),
        None,
    ),
]


def turn_models(pairs):
    return [
        TurnModel(
            sequence=index,
            step_id=step.id,
            step_kind=step.kind.value,
            question=step.prompt,
            answer=answer,
            actor=ACTOR,
            answered_at=datetime(2026, 7, 31, 9, 15 + index, 3, tzinfo=timezone.utc),
        )
        for index, (step, answer) in enumerate(pairs)
    ]


PLAN = ConsumptionPlanRecord(
    id="cp7f3a12c94e5b4d0a9c31",
    session_id=I13_SESSION,
    reservation_number=None,
    reservation_item=None,
    material="1000000123",
    plant="1300",
    purpose=PLAN_ANSWER["purpose"],
    planned_quantity=Decimal(PLAN_ANSWER["planned_quantity"]),
    window_start=date(2026, 8, 10),
    window_end=date(2026, 8, 21),
    cost_centre="1300-MNT",
    order_number="4001234567",
    status="OPEN",
    captured_by=ACTOR,
    captured_at=datetime(2026, 7, 31, 9, 16, 3, tzinfo=timezone.utc),
)

SUGGESTION_ROW = QuantitySuggestionRecord(
    id="qs2b90d4417ca84f6e8d55",
    session_id=I13_SESSION,
    material="1000000123",
    plant="1300",
    requested_quantity=SUGGESTION.requested_quantity,
    suggested_quantity=SUGGESTION.suggested_quantity,
    accepted_quantity=SUGGESTION.requested_quantity,
    suggestion_reason=SUGGESTION.reason,
    stock_on_hand=SUGGESTION.stock_on_hand,
    open_po_quantity=SUGGESTION.open_po_quantity,
    average_monthly_consumption=SUGGESTION.average_monthly_consumption,
    months_of_cover=SUGGESTION.months_of_cover,
    cover_ceiling_months=SUGGESTION.config.cover_ceiling_months,
    lookback_months=SUGGESTION.config.lookback_months,
    min_history_consumptions=SUGGESTION.config.min_history_consumptions,
    consumption_count=SUGGESTION.consumption_count,
    suggested_at=datetime(2026, 7, 31, 9, 17, 3, tzinfo=timezone.utc),
)

JUSTIFICATION = Justification(
    id="ju5c81ef307ab24d919f62",
    session_id=I13_SESSION,
    exception_id=None,
    kind="QUANTITY_OVERRIDE",
    reason_category=JUSTIFY_QTY["reason_category"],
    free_text=JUSTIFY_QTY["free_text"],
    material_id="1000000123",
    plant="1300",
    author=ACTOR,
    recorded_at=datetime(2026, 7, 31, 9, 18, 3, tzinfo=timezone.utc),
)

write(
    "16-session-trace-i13.json",
    SessionTraceResponse(
        session_id=I13_SESSION,
        flow="i13",
        outcome="COMPLETED",
        material_id="1000000123",
        plant="1300",
        department=DEPARTMENT,
        requested_for=REQUESTED_FOR,
        # A session minted BEFORE the entry point stopped asking. Kept with a
        # value on purpose: those rows exist, the column stays for them, and a
        # fixture where every trace had null would stop proving the UI can
        # still render one.
        requested_quantity="5",
        requester=ACTOR,
        origin="BADI",
        issued_at=ISSUED_AT,
        expires_at=EXPIRES_AT,
        expired=False,
        routing_reason=I13_ROUTED.reason,
        assessment=I13_OVERRIDE.as_record(TODAY),
        narrative=None,
        turns=turn_models(I13_TRACE_STEPS),
        plans=[_plan_model(PLAN)],
        quantity_suggestions=[_suggestion_model(SUGGESTION_ROW)],
        justifications=[_justification_model(JUSTIFICATION)],
        linkage_note=LINKAGE_NOTE,
    ),
)

I08_TRACE_STEPS = [
    (i08_step({}), {"choice": script.PROCEED_NEW}),
    (i08_step({script.I08_ASSESSMENT: {"choice": script.PROCEED_NEW}}), JUSTIFY_I08),
    (
        i08_step(
            {
                script.I08_ASSESSMENT: {"choice": script.PROCEED_NEW},
                script.I08_JUSTIFICATION: JUSTIFY_I08,
            }
        ),
        None,
    ),
]

write(
    "17-session-trace-i08.json",
    SessionTraceResponse(
        session_id=I08_SESSION,
        flow="i08",
        outcome="COMPLETED",
        material_id="8000005632",
        plant="1300",
        department=DEPARTMENT,
        requested_for=REQUESTED_FOR,
        # Null, as every session minted since the entry point stopped asking.
        requested_quantity=None,
        requester=ACTOR,
        origin="PLATFORM",
        issued_at=ISSUED_AT,
        expires_at=EXPIRES_AT,
        expired=False,
        routing_reason=I08_ROUTED.reason,
        assessment=I08_OVERDUE.as_record(TODAY),
        narrative=None,
        turns=turn_models(I08_TRACE_STEPS),
        plans=[],
        quantity_suggestions=[],
        justifications=[
            _justification_model(
                Justification(
                    id="ju1a44bc9052e6478db073",
                    session_id=I08_SESSION,
                    exception_id=None,
                    kind="NEW_ACQUISITION",
                    reason_category=JUSTIFY_I08["reason_category"],
                    free_text=JUSTIFY_I08["free_text"],
                    material_id="8000005632",
                    plant="1300",
                    author=ACTOR,
                    recorded_at=datetime(2026, 7, 31, 9, 17, 3, tzinfo=timezone.utc),
                )
            )
        ],
        linkage_note=LINKAGE_NOTE,
    ),
)

print("")
print("suggested:", SUGGESTION.suggested_quantity, "requested:", SUGGESTION.requested_quantity)
print("i08 caveats:", I08_OVERDUE.verdict.caveats)
print("i08 two-line caveats:", I08_TWO_LINES.verdict.caveats)
print("i13 caveats:", I13_OVERRIDE.caveats)
