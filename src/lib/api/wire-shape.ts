/**
 * A compile-time contract check that survives JSON imports.
 *
 * ## The problem this solves
 *
 * The obvious way to check a fixture against a declared type is to assign it:
 *
 *     const payload: StartSessionResponse = fixtureJson
 *
 * That does not compile, and not because anything is wrong. TypeScript infers
 * a JSON import's string values as `string`, so a field declared
 * `"i08" | "i13" | "none"` rejects a fixture whose value is a perfectly valid
 * `"i08"`. The tempting escape is `fixtureJson as unknown as T`, which
 * compiles — and checks **nothing at all**, because a double assertion
 * silences every error including the real ones.
 *
 * That is not hypothetical. It is how `repairDueDateIsReliable` shipped typed
 * `boolean` while the backend sends `boolean | null`, producing a card that
 * told a planner a repair deadline had been missed on a part with no repair
 * and no deadline. The fixtures contained the null. Nothing looked.
 *
 * ## What `Widen` does
 *
 * It rewrites a type with every string-literal union relaxed to `string`, and
 * changes nothing else. Key presence, nullability, optionality, numbers,
 * booleans, arrays and nesting all still have to match. So a fixture can be
 * assigned to `Widen<T>` and the assignment is a genuine check of everything
 * that JSON inference does not already destroy — including the exact class of
 * bug above, which it catches as
 * `Type 'null' is not assignable to type 'boolean'`.
 *
 * Literal values are then pinned at runtime instead, by ordinary expectations
 * in the test (`expect(routing.flow).toBe("i08")`). Between the two, the
 * contract is covered.
 */
export type Widen<T> = T extends string
  ? string
  : T extends readonly (infer E)[]
    ? Widen<E>[]
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T

/**
 * Assert at compile time that a fixture conforms to a wire type, and return it
 * typed for the runtime expectations that follow.
 *
 * The parameter is `Widen<T>`, so passing a fixture whose shape has drifted is
 * a type error at the call site. The return is `T`, so the test body can read
 * literal-typed fields normally.
 *
 * The cast inside is the one place in this codebase where a double assertion
 * is correct: the widening has already been verified by the parameter type, so
 * narrowing back is sound rather than a way of avoiding the question.
 */
export function conformsToWire<T>(fixture: Widen<T>): T {
  return fixture as unknown as T
}
