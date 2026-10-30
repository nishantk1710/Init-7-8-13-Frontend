// What a blocked recommendation says about why it has no recommended Min-Max values.
//
// The backend stores the blocker as a code (the similarity search's own outcome, or the estimate's). A user
// reading "NO_SIMILAR_MATERIALS_FOUND" learns little, so the codes it is known to write are put in words here.
// Anything else is shown as the backend wrote it: an unknown reason is never replaced with a guess.

const PLAIN_REASONS: Record<string, string> = {
  // The search completed and found nothing usable. (Older rows hold "SUCCESS" here: the search's status, not a
  // result -- read the same way.)
  NO_SIMILAR_MATERIALS_FOUND:
    "No similar materials were found to estimate Min-Max values from, so there is nothing to convert.",
  SUCCESS:
    "No similar materials were found to estimate Min-Max values from, so there is nothing to convert.",
  NO_ELIGIBLE_NEIGHBORS:
    "None of the similar materials qualified, so Min-Max values could not be estimated and there is nothing to convert.",
  NOT_EVALUABLE_INSUFFICIENT_NEIGHBOURS:
    "Too few similar materials were found to estimate Min-Max values reliably, so there is nothing to convert.",
  SERVICE_LEVEL_UNSET:
    "The service level for this criticality has not been signed off, so Min-Max values could not be calculated.",
}

/** The reason in plain words when the code is a known one, else the code as the backend wrote it. */
export function blockingReasonText(reason: string): string {
  return PLAIN_REASONS[reason.trim()] ?? reason
}
