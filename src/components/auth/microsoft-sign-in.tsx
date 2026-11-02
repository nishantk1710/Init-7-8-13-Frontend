import { signIn } from "@/auth"
import { AuthSubmit, FormError } from "@/components/auth/auth-field"

/** What Auth.js's ?error= codes mean to the person at the sign-in page. */
const ERROR_TEXT: Record<string, string> = {
  AccessDenied:
    "Your Microsoft account does not have access to Spares AI. Ask VZI IT to assign you to the application.",
  Configuration: "Sign-in is not set up correctly on this server. Contact the Spares AI support team.",
  RefreshTokenError: "Your session has expired. Sign in again to continue.",
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" aria-hidden className="size-4">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

/**
 * The whole sign-in form when AUTH_MODE=entra: one button. Accounts, passwords,
 * multi-factor sign-in and who may use Spares AI are all Entra ID's business.
 */
export function MicrosoftSignIn({
  next,
  error,
  missingSettings,
}: {
  next: string
  error?: string
  missingSettings: string[]
}) {
  async function start() {
    "use server"
    await signIn("microsoft-entra-id", { redirectTo: next })
  }

  if (missingSettings.length > 0) {
    return (
      <FormError>
        Microsoft sign-in is switched on but not configured on this server (missing:{" "}
        {missingSettings.join(", ")}). Contact the Spares AI support team.
      </FormError>
    )
  }

  return (
    <form action={start} className="flex flex-col gap-[18px]">
      {error && (
        <FormError>{ERROR_TEXT[error] ?? "Sign-in did not complete. Try again, or contact the Spares AI support team."}</FormError>
      )}
      <AuthSubmit icon={<MicrosoftLogo />} pendingLabel="Opening Microsoft sign-in…">
        Sign in with Microsoft
      </AuthSubmit>
      <p className="m-0 text-center text-[13px] text-aurora-muted">Use your VZI Microsoft account.</p>
    </form>
  )
}
