// What each OAR Utilization dashboard card and Details tab explains in its (i) popup: the rule in
// plain words, how it is worked out, and one example with small made-up numbers. The same layout as
// the Initiative 7 and 8 Overview popups.
//
// Every rule here is the backend's, read from it on 27 Oct 2026, never a rule of this screen's own:
//   OAR scope        MARC-DISPO = OAR, material not flagged for deletion   (I13_OAR_MRP_CONTROLLERS)
//   movement bands   days since the last goods issue: <= 365 fast, <= 730 slow, else or never: non-moving
//                    (app/initiatives/i13/aging.py, I13_AGING_FAST_MAX_DAYS / I13_AGING_SLOW_MAX_DAYS)
//   GR not issued    oldest receipt still not issued >= 30 days, per material and plant (watch.py)
//   plan overdue     planned usage window end + 14 days passed, nothing issued (exceptions.py)
//   non-AI           OAR reservation line, not deleted, no consumption plan matched (exceptions.py)
//   acquired vs plan received vs planned, exact comparison, per material and plant (watch.py)
// The thresholds are backend settings; if one changes, change its text here. dashboard-info.test.ts
// checks each example lands in the band its text claims.
import type { InfoTone } from "@/components/shared/info-popup"

export type DashboardInfoId =
  | "totalOar"
  | "fastMoving"
  | "slowMoving"
  | "nonMoving"
  | "grNotIssued"
  | "planOverdue"
  | "nonAi"
  | "exceptionPipeline"
  | "nonMoversTab"
  | "acquiredVsPlanTab"
  | "capturedPlansTab"
  | "justificationsTab"

export interface DashboardInfoExample {
  /** What the example is about, e.g. "One material at Black Mountain (1300)". */
  subject: string
  /** The values read for it: label and value. */
  inputs: { label: string; value: string }[]
  /** The outcome, in a sentence. */
  result: string
}

export interface DashboardInfoSpec {
  title: string
  /** The popup's accent colour: the tone of the card it explains. */
  tone: InfoTone
  /** One sentence: the question this answers. */
  summary: string
  /** The rule, one line per row. */
  rule: string[]
  /** What a reader needs to know to read the number correctly. */
  steps: string[]
  /** Always illustrative numbers, never a real material. */
  example: DashboardInfoExample
}

/** The as-of date every example is worked from. */
export const EXAMPLE_AS_OF = "27 Oct 2026"

export const DASHBOARD_INFO: Record<DashboardInfoId, DashboardInfoSpec> = {
  totalOar: {
    title: "Total OAR materials",
    tone: "info",
    summary: "How many OAR material-plant positions are in scope.",
    rule: [
      "A position = one material at one plant",
      "counted when its MRP controller (MARC-DISPO) is OAR",
      "and the material is not flagged for deletion in SAP",
    ],
    steps: [
      "Counted once per material and plant: the same material at Gamsberg (1500) and Black Mountain (1300) is two positions.",
      "Fast-moving, slow-moving and non-moving split this total; the three add up to it.",
      "The plant and material filters narrow the count.",
    ],
    example: {
      subject: "Four material-plants",
      inputs: [
        { label: "Material A at 1300, MRP controller OAR", value: "counted" },
        { label: "Material A at 1500, MRP controller OAR", value: "counted" },
        { label: "Material B at 1300, another MRP controller", value: "not counted" },
        { label: "Material C at 1500, OAR but flagged for deletion", value: "not counted" },
      ],
      result: "Total OAR materials = 2.",
    },
  },
  fastMoving: {
    title: "Fast-moving",
    tone: "success",
    summary: "OAR positions issued from stock within the last year.",
    rule: [
      "Days since last issue = data as-of date − date of the last goods issue",
      "Fast-moving: 365 days or fewer",
    ],
    steps: [
      "A goods issue is stock leaving the store against a reservation, work order or cost centre.",
      "The as-of date is the one shown at the top of the page.",
      "Receipts do not count: a material received yesterday but not issued for two years is not fast-moving.",
    ],
    example: {
      subject: "One material at Black Mountain (1300)",
      inputs: [
        { label: "Last goods issue", value: "10 Mar 2026" },
        { label: "Data as of", value: EXAMPLE_AS_OF },
        { label: "Days since last issue", value: "231" },
      ],
      result: "231 ≤ 365, so it is fast-moving.",
    },
  },
  slowMoving: {
    title: "Slow-moving",
    tone: "warning",
    summary: "OAR positions last issued between one and two years ago.",
    rule: [
      "Days since last issue = data as-of date − date of the last goods issue",
      "Slow-moving: 366 to 730 days",
    ],
    steps: [
      "The same measure as fast-moving, with a longer gap since the last issue.",
      "One more issue moves the position back to fast-moving on the next data load.",
    ],
    example: {
      subject: "One material at Gamsberg (1500)",
      inputs: [
        { label: "Last goods issue", value: "2 Jan 2025" },
        { label: "Data as of", value: EXAMPLE_AS_OF },
        { label: "Days since last issue", value: "663" },
      ],
      result: "663 is between 366 and 730, so it is slow-moving.",
    },
  },
  nonMoving: {
    title: "Non-moving",
    tone: "danger",
    summary: "OAR positions not issued for more than two years, or never issued.",
    rule: [
      "Days since last issue = data as-of date − date of the last goods issue",
      "Non-moving: more than 730 days, or no goods issue on record",
    ],
    steps: [
      "A position with no issue in the history the platform holds counts as non-moving.",
      "The Non-movers tab below lists each one.",
    ],
    example: {
      subject: "Two materials at Black Mountain (1300)",
      inputs: [
        { label: "Material A: last goods issue", value: "15 Jun 2023" },
        { label: "Material A: days since last issue", value: "1,230" },
        { label: "Material B: last goods issue", value: "none on record" },
      ],
      result: "Both are non-moving: 1,230 > 730, and B was never issued.",
    },
  },
  grNotIssued: {
    title: "GR not issued (30d)",
    tone: "danger",
    summary: "OAR positions where goods were received for a reservation and are still not issued 30 days later.",
    rule: [
      "For each reservation line: outstanding = received − issued",
      "For the lines with something outstanding: age = as-of date − last goods receipt",
      "Counted when the oldest age is 30 days or more",
    ],
    steps: [
      "Counted once per material and plant, however many lines are outstanding.",
      "A line that was partly issued still counts for what remains.",
      "Only OAR positions are counted.",
    ],
    example: {
      subject: "One material at Gamsberg (1500), two reservation lines",
      inputs: [
        { label: "Line 1: received 4, issued 4", value: "nothing outstanding" },
        { label: "Line 2: received 6 on 1 Sep 2026, issued 2", value: "4 outstanding" },
        { label: "Line 2: days since receipt", value: "56" },
      ],
      result: "56 ≥ 30, so the material counts once.",
    },
  },
  planOverdue: {
    title: "Planned Consumption Overdue",
    tone: "warning",
    summary: "Open consumption plans whose planned use has passed with nothing issued.",
    rule: [
      "Due date = end of the planned usage window + 14 days",
      "Overdue when the as-of date is after the due date",
      "and no goods issue is recorded for the plan's reservation",
    ],
    steps: [
      "Only open plans count: a closed plan cannot be overdue.",
      "A captured plan not yet linked to a reservation is matched by material, plant and usage window.",
      "Each plan counts once.",
    ],
    example: {
      subject: "One plan captured in the assistant",
      inputs: [
        { label: "Usage window ends", value: "30 Sep 2026" },
        { label: "Due date (+14 days)", value: "14 Oct 2026" },
        { label: "Issued against the reservation", value: "0" },
        { label: "Data as of", value: EXAMPLE_AS_OF },
      ],
      result: "Past its due date with nothing issued, so it counts — 13 days overdue.",
    },
  },
  nonAi: {
    title: "Non-AI Reservations",
    tone: "info",
    summary: "OAR reservation lines that have no consumption plan from the assistant.",
    rule: [
      "One OAR reservation line (reservation number + item)",
      "not deleted in SAP",
      "with no consumption plan matched to it",
    ],
    steps: [
      "Counted per reservation line, not per PO line: a line split over several POs counts once.",
      "A reservation made through the assistant links to its plan through the request reference in its item text, once SAP's next data load carries it.",
    ],
    example: {
      subject: "Three reservation lines",
      inputs: [
        { label: "1000001/1: made in SAP without the assistant", value: "counted" },
        { label: "1000002/1: made from an assistant request with a plan", value: "not counted" },
        { label: "1000003/2: deleted in SAP", value: "not counted" },
      ],
      result: "Non-AI Reservations = 1.",
    },
  },
  exceptionPipeline: {
    title: "Exception follow-up pipeline",
    tone: "info",
    summary: "Where each procurement exception sits in the follow-up workflow.",
    rule: [
      "Requester not identified → nobody can be asked",
      "Assigned to requester → 5 days to give a reason",
      "Escalated to HOD → no reason given within 5 days",
      "Reason given → the requester recorded why",
      "Closed → the condition that raised it no longer holds",
    ],
    steps: [
      "The requester is the assistant user, or else the goods recipient on the SAP reservation.",
      "An exception closes on the next detection run once its condition clears, for example when material is issued against an overdue plan.",
      "Escalations stay pending until an HOD is set up for the plant.",
    ],
    example: {
      subject: "One Non-AI exception",
      inputs: [
        { label: "Detected, goods recipient found", value: "20 Oct 2026" },
        { label: "Reason due", value: "25 Oct 2026" },
        { label: "Reason given by then", value: "no" },
      ],
      result: "It moved from Assigned to requester to Escalated to HOD on 25 Oct 2026.",
    },
  },
  nonMoversTab: {
    title: "Non-movers",
    tone: "danger",
    summary: "Each non-moving OAR position, one row per material and plant.",
    rule: [
      "Non-moving: last goods issue more than 730 days ago, or never issued",
      "Days shown = data as-of date − last goods issue",
    ],
    steps: [
      "The page's plant, material and stock-type filters apply to this list.",
      "Critical impact comes from the criticality file (ZMM065); it shows Unknown when that file is not available.",
    ],
    example: {
      subject: "One material at Black Mountain (1300)",
      inputs: [
        { label: "Last goods issue", value: "15 Jun 2023" },
        { label: "Data as of", value: EXAMPLE_AS_OF },
        { label: "Days since last issue", value: "1,230" },
      ],
      result: "Listed here: 1,230 > 730.",
    },
  },
  acquiredVsPlanTab: {
    title: "Acquired vs plan",
    tone: "warning",
    summary: "Received quantity against the consumption plan, per material and plant.",
    rule: [
      "Planned = the planned quantities of the position's consumption plans, added up",
      "Received = goods received for the position's reservations",
      "On plan: received = planned · Below: received < planned · Above: received > planned",
      "Non-AI: no plan, so nothing to compare",
    ],
    steps: [
      "The comparison is exact: no tolerance band is configured, so 9 against a plan of 10 is Below plan.",
      "Variance = received − planned, also shown as a percentage of planned.",
    ],
    example: {
      subject: "One material at Gamsberg (1500)",
      inputs: [
        { label: "Planned (two plans: 4 + 6)", value: "10" },
        { label: "Received", value: "12" },
        { label: "Variance", value: "+2 (+20%)" },
      ],
      result: "12 > 10, so it is Above plan.",
    },
  },
  capturedPlansTab: {
    title: "Captured plans",
    tone: "info",
    summary: "Consumption plans requesters stated in the assistant.",
    rule: [
      "One row per plan captured in an assistant session",
      "Material, plant, planned quantity, usage window and purpose, as the requester gave them",
    ],
    steps: [
      "Generated reference plans are not shown here.",
      "The reservation fills in once SAP's next data load carries the request reference; until then it reads Not linked.",
      "The session link opens the conversation the plan came from.",
    ],
    example: {
      subject: "One plan",
      inputs: [
        { label: "Planned quantity", value: "4" },
        { label: "Usage window", value: "1–30 Nov 2026" },
        { label: "Reservation", value: "Not linked yet" },
      ],
      result: "The reservation appears after the next SAP data load.",
    },
  },
  justificationsTab: {
    title: "Justifications",
    tone: "info",
    summary: "Reasons requesters gave, at reservation time and when an exception was followed up.",
    rule: [
      "Bought new anyway: why buy new rather than repair (from the assistant)",
      "Kept a larger quantity: why not take the suggested quantity (from the assistant)",
      "Plan breached / No plan given: the reason recorded when an exception was confirmed",
    ],
    steps: [
      "Each row says which kind it is: a reason given before the reservation is different evidence from one given weeks later.",
      "Covers the most recent confirmations only.",
    ],
    example: {
      subject: "One reservation made in the assistant",
      inputs: [
        { label: "Suggested quantity", value: "2" },
        { label: "Requested quantity", value: "4" },
        { label: "Reason given", value: "Two pumps share this part" },
      ],
      result: "Shown here as Kept a larger quantity.",
    },
  },
}
