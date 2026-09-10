// W2.6a — parse an OData v2 $filter into a predicate the gateway can run.
//
// Deliberately covers the query surface we actually use and no more (§7.2):
// eq/ne/gt/ge/lt/le, and/or/not, parentheses, and the startswith/substringof
// functions. Anything outside that raises rather than quietly matching
// everything — a filter that silently does nothing is the worst outcome, and
// we have already seen the real SAP gateway do exactly that with `and`-chained
// `ne` (phase_summary.md Phase 0).

export type FilterRow = Record<string, unknown>
export type FilterPredicate = (row: FilterRow) => boolean

type Token =
  | { kind: "identifier"; value: string }
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "(" }
  | { kind: ")" }
  | { kind: "," }

const COMPARISONS = new Set(["eq", "ne", "gt", "ge", "lt", "le"])

export class FilterParseError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const char = input[i]

    if (/\s/.test(char)) {
      i++
      continue
    }

    if (char === "(") {
      tokens.push({ kind: "(" })
      i++
      continue
    }
    if (char === ")") {
      tokens.push({ kind: ")" })
      i++
      continue
    }
    if (char === ",") {
      tokens.push({ kind: "," })
      i++
      continue
    }

    if (char === "'") {
      // OData escapes a quote by doubling it.
      let value = ""
      i++
      for (;;) {
        if (i >= input.length) throw new FilterParseError(`Unterminated string literal in: ${input}`)
        if (input[i] === "'") {
          if (input[i + 1] === "'") {
            value += "'"
            i += 2
            continue
          }
          i++
          break
        }
        value += input[i++]
      }
      tokens.push({ kind: "string", value })
      continue
    }

    const rest = input.slice(i)
    const number = /^-?\d+(\.\d+)?/.exec(rest)
    if (number && /^[-\d]/.test(char)) {
      tokens.push({ kind: "number", value: Number(number[0]) })
      i += number[0].length
      continue
    }

    const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest)
    if (identifier) {
      tokens.push({ kind: "identifier", value: identifier[0] })
      i += identifier[0].length
      continue
    }

    throw new FilterParseError(`Unexpected character ${JSON.stringify(char)} in filter: ${input}`)
  }

  return tokens
}

function compare(operator: string, left: unknown, right: unknown): boolean {
  // Everything the gateway serves is text or numeric-text; compare like with like.
  const a = typeof left === "number" ? left : String(left ?? "")
  const b = typeof right === "number" ? right : String(right ?? "")

  switch (operator) {
    case "eq":
      return a === b
    case "ne":
      return a !== b
    case "gt":
      return a > b
    case "ge":
      return a >= b
    case "lt":
      return a < b
    case "le":
      return a <= b
    default:
      throw new FilterParseError(`Unsupported comparison operator: ${operator}`)
  }
}

/** Parse an OData v2 `$filter` expression into a predicate. */
export function parseFilter(expression: string): FilterPredicate {
  const tokens = tokenize(expression)
  let position = 0

  const peek = (): Token | undefined => tokens[position]

  function peekKeyword(word: string): boolean {
    const token = peek()
    return token?.kind === "identifier" && token.value.toLowerCase() === word
  }

  function expect(kind: Token["kind"]): Token {
    const token = tokens[position++]
    if (!token || token.kind !== kind) {
      throw new FilterParseError(`Expected ${kind} at position ${position - 1} in: ${expression}`)
    }
    return token
  }

  function parseOr(): FilterPredicate {
    let left = parseAnd()
    while (peekKeyword("or")) {
      position++
      const right = parseAnd()
      const previous = left
      left = (row) => previous(row) || right(row)
    }
    return left
  }

  function parseAnd(): FilterPredicate {
    let left = parseUnary()
    while (peekKeyword("and")) {
      position++
      const right = parseUnary()
      const previous = left
      left = (row) => previous(row) && right(row)
    }
    return left
  }

  function parseUnary(): FilterPredicate {
    if (peekKeyword("not")) {
      position++
      const inner = parseUnary()
      return (row) => !inner(row)
    }

    if (peek()?.kind === "(") {
      position++
      const inner = parseOr()
      expect(")")
      return inner
    }

    return parseComparison()
  }

  function parseOperand(): { get: (row: FilterRow) => unknown } {
    const token = tokens[position++]
    if (!token) throw new FilterParseError(`Unexpected end of filter: ${expression}`)
    if (token.kind === "string") return { get: () => token.value }
    if (token.kind === "number") return { get: () => token.value }
    if (token.kind === "identifier") return { get: (row) => row[token.value] }
    throw new FilterParseError(`Unexpected ${token.kind} in filter: ${expression}`)
  }

  function parseComparison(): FilterPredicate {
    const token = peek()

    if (token?.kind === "identifier" && tokens[position + 1]?.kind === "(") {
      const name = token.value.toLowerCase()
      position += 2
      const first = parseOperand()
      expect(",")
      const second = parseOperand()
      expect(")")

      if (name === "startswith") {
        return (row) => String(first.get(row) ?? "").startsWith(String(second.get(row) ?? ""))
      }
      if (name === "endswith") {
        return (row) => String(first.get(row) ?? "").endsWith(String(second.get(row) ?? ""))
      }
      if (name === "substringof") {
        // OData v2 argument order: substringof(needle, haystack)
        return (row) => String(second.get(row) ?? "").includes(String(first.get(row) ?? ""))
      }
      throw new FilterParseError(`Unsupported filter function: ${name}`)
    }

    const left = parseOperand()
    const operatorToken = tokens[position++]
    if (!operatorToken || operatorToken.kind !== "identifier" || !COMPARISONS.has(operatorToken.value.toLowerCase())) {
      throw new FilterParseError(
        `Expected a comparison operator (${[...COMPARISONS].join(", ")}) in: ${expression}`
      )
    }
    const right = parseOperand()
    const operator = operatorToken.value.toLowerCase()
    return (row) => compare(operator, left.get(row), right.get(row))
  }

  const predicate = parseOr()
  if (position !== tokens.length) {
    throw new FilterParseError(`Unparsed trailing input in filter: ${expression}`)
  }
  return predicate
}
