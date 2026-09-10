// W2.1 — typed errors. Callers must be able to tell "SAP is down" from "you
// asked for something that isn't there" from "SAP gave us a shape we don't
// understand", because those need three different responses in the UI and
// three different reactions from an on-call engineer.

export class SapError extends Error {
  constructor(
    message: string,
    readonly context: { entitySet?: string; status?: number; query?: string } = {}
  ) {
    super(message)
    this.name = new.target.name
  }
}

/** Credentials or token exchange failed. Retrying without new credentials will not help. */
export class AuthError extends SapError {}

/** A 5xx or a network failure. Worth retrying with backoff. */
export class TransientError extends SapError {}

/** A 404 — the path or entity does not exist. Never retried; retrying cannot fix a wrong URL. */
export class NotFoundError extends SapError {}

/** SAP responded, but with a shape or type the contract says is impossible. This is drift. */
export class ContractError extends SapError {}

/** A 4xx that is none of the above — a bad filter, usually. Not retried. */
export class RequestError extends SapError {}
