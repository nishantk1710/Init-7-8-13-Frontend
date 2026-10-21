/**
 * The reservation assistant's demo switch. **Temporary.**
 *
 *   NEXT_PUBLIC_ASSISTANT_DEMO=true    the assistant runs two scripted sessions
 *   (unset / anything else)            the assistant is live, as before
 *
 * Exists because the deployed backend cannot yet open a session for a real
 * repairable or OAR material end to end (an OAR part WATCH has never seen is a
 * 422). The demo replays the checked-in wire fixtures in `lib/api/__fixtures__`,
 * which are byte-for-byte what the backend emits, entirely in the browser:
 * nothing is written to the append-only session tables, so nothing has to be
 * cleaned up and no adoption or compliance figure is touched.
 *
 * Only the assistant is affected. Every other screen stays live. This is not
 * the Data source toggle (`lib/data-mode.ts`), which swaps the whole app to
 * main's old frontend.
 *
 * ## Switching it off
 *
 * Once the deployed backend opens a session for a real 80-series and a real OAR
 * material at 1300/1500, and `GET /assistant/materials` returns named results:
 * remove the variable from the deploy workflow's build step and redeploy. It is
 * read at build time, like every `NEXT_PUBLIC_*`.
 *
 * Removing the code afterwards: delete `lib/assistant/demo/` and
 * `components/assistant/demo/`, then `grep -rn ASSISTANT_DEMO src` and drop each
 * branch. Keep the fixtures -- the type tests read them.
 */
export const ASSISTANT_DEMO = process.env.NEXT_PUBLIC_ASSISTANT_DEMO === "true"
