// W2.1 — configuration, never constants. Everything that differs between a
// workstation, CI, and Azure comes from the environment.

import { AuthError } from "./errors"

export interface CpiConfig {
  baseUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  /** The CPI iFlow path that fronts every OData call. */
  cpiPath: string
  /** Page size for paged reads. Conservative by default; real limits are unproven (§4). */
  pageSize: number
}

const DEFAULT_CPI_PATH = "/http/SAPECC/OdataConsumption"
const DEFAULT_PAGE_SIZE = 1000

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (!value) {
    throw new AuthError(
      `Missing ${name}. Set it in the environment (see data-generator/.env for the key names). ` +
        `Never hard-code CPI credentials.`
    )
  }
  return value
}

export function loadCpiConfig(env: NodeJS.ProcessEnv = process.env): CpiConfig {
  return {
    baseUrl: required(env, "CPI_BASE_URL").replace(/\/+$/, ""),
    tokenUrl: required(env, "CPI_TOKEN_URL"),
    clientId: required(env, "CPI_CLIENT_ID"),
    clientSecret: required(env, "CPI_CLIENT_SECRET"),
    cpiPath: env.CPI_PATH || DEFAULT_CPI_PATH,
    pageSize: env.CPI_PAGE_SIZE ? Number(env.CPI_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
  }
}
