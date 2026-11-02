// Which sign-in the app runs with, decided at RUNTIME by the AUTH_MODE setting.
//
//   mock   (default)  the test sign-in in lib/auth/mock-auth.ts -- any listed
//                     username, any password. Exactly the app before Entra.
//   entra             "Sign in with Microsoft" (src/auth.ts, Auth.js) against
//                     VZI's Entra ID; the API receives the user's access token.
//
// A runtime App Service setting, not a NEXT_PUBLIC_* build variable, so
// switching back to mock is the rollback and needs no rebuild or redeploy.
//
// The server reads process.env; the browser cannot, so src/proxy.ts copies the
// mode into the AUTH_MODE_COOKIE cookie on every page response and client code
// reads that. Kept free of imports: src/proxy.ts imports it too.

export type AuthMode = "entra" | "mock"

export const AUTH_MODE_COOKIE = "spares-auth-mode"

export function parseAuthMode(value: string | null | undefined): AuthMode {
  return value?.trim().toLowerCase() === "entra" ? "entra" : "mock"
}

/** Server side (proxy, route handlers, dynamic server components): the AUTH_MODE setting. */
export function serverAuthMode(): AuthMode {
  return parseAuthMode(process.env.AUTH_MODE)
}

/** Browser side: the mode src/proxy.ts stamped on the last page response. */
export function browserAuthMode(): AuthMode {
  if (typeof document === "undefined") return "mock"
  for (const part of document.cookie.split(";")) {
    const [name, ...value] = part.trim().split("=")
    if (name === AUTH_MODE_COOKIE) return parseAuthMode(decodeURIComponent(value.join("=")))
  }
  return "mock"
}
