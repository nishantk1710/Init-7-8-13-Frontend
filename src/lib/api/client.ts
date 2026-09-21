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
    /** Machine-readable code from the backend's {error:{code,message,details}}
     * envelope (see app/schemas/i7/errors.py), when the response body parsed
     * as that shape. Undefined for a network failure or a non-JSON body. */
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fetch a JSON resource from the backend. Throws ApiError on a non-2xx
 * response, or on a network failure (fetch rejecting outright). */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const method = init?.method ?? "GET";

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      `${method} ${url} failed: backend unreachable`,
      0,
    );
  }

  if (!response.ok) {
    // Every I07 route returns {error:{code,message,details}} (see
    // app/schemas/i7/errors.py) -- surface the human message and machine
    // code when the body actually has that shape, instead of only the HTTP
    // status text.
    let code: string | undefined;
    let message = `${method} ${url} failed with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      if (body?.error?.message) message = body.error.message;
      if (body?.error?.code) code = body.error.code;
    } catch {
      // Non-JSON error body -- keep the generic message above.
    }
    throw new ApiError(message, response.status, code);
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
