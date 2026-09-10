/**
 * Minimal client for the FastAPI backend.
 *
 * The existing UI runs entirely on mock data and does not use this yet -- it
 * exists so that when backend calls are introduced they go through one place
 * with one base URL, instead of `localhost` being hardcoded across components.
 *
 * Configure the base URL with NEXT_PUBLIC_API_BASE_URL (see .env.example).
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fetch a JSON resource from the backend. Throws ApiError on a non-2xx response. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(
      `${init?.method ?? "GET"} ${url} failed with ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export type HealthResponse = {
  status: string;
  service: string;
};

/** Calls GET /api/health. Used to verify frontend -> backend connectivity. */
export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}
