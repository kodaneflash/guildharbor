"use client";
import { useActionState, useState } from "react";
import { authClient } from "@/lib/auth-client";
type State = { message: string; error: boolean };
export function SecurityForm({
  enabled,
  hasPassword,
}: {
  enabled: boolean;
  hasPassword: boolean;
}) {
  const [uri, setUri] = useState("");
  const [isEnabled, setEnabled] = useState(enabled);
  async function changePassword(_: State, form: FormData): Promise<State> {
    const result = await authClient.changePassword({
      currentPassword: String(form.get("currentPassword")),
      newPassword: String(form.get("newPassword")),
      revokeOtherSessions: true,
    });
    return {
      error: Boolean(result.error),
      message: result.error?.message ?? "Password changed.",
    };
  }
  async function enroll(_: State, form: FormData): Promise<State> {
    if (uri) {
      const result = await authClient.twoFactor.verifyTotp({
        code: String(form.get("code")),
      });
      if (result.error)
        return {
          error: true,
          message: result.error.message ?? "Invalid code.",
        };
      setEnabled(true);
      setUri("");
      return { error: false, message: "Two-factor authentication is enabled." };
    }
    const result = await authClient.twoFactor.enable({
      password: String(form.get("password")),
    });
    if (result.error)
      return {
        error: true,
        message: result.error.message ?? "Unable to start enrollment.",
      };
    setUri(result.data.totpURI);
    return {
      error: false,
      message:
        "Add the setup key to your authenticator, then enter its six-digit code to finish.",
    };
  }
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePassword,
    { message: "", error: false },
  );
  const [totpState, totpAction, totpPending] = useActionState(enroll, {
    message: "",
    error: false,
  });
  if (!hasPassword)
    return (
      <section className="surface p-6">
        <p className="text-text-muted">
          Your account uses social sign-in. Set a password using the password
          reset flow before changing a password or enrolling an authenticator.
        </p>
        <a className="button-secondary mt-4" href="/forgot-password">
          Set a password
        </a>
      </section>
    );
  return (
    <div className="space-y-5">
      <form action={passwordAction} className="surface space-y-4 p-6">
        <h2 className="text-xl font-bold">Change password</h2>
        <label className="block text-sm">
          Current password
          <input
            className="field mt-2"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label className="block text-sm">
          New password
          <input
            className="field mt-2"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <p
          role="status"
          className={passwordState.error ? "text-danger" : "text-trust"}
        >
          {passwordState.message}
        </p>
        <button disabled={passwordPending} className="button-primary">
          Change password
        </button>
      </form>
      <section className="surface space-y-4 p-6">
        <h2 className="text-xl font-bold">Two-factor authentication</h2>
        {isEnabled ? (
          <p className="text-trust">An authenticator is enrolled.</p>
        ) : (
          <form action={totpAction} className="space-y-4">
            {uri ? (
              <>
                <p className="text-sm text-text-muted">
                  In your authenticator, add a time-based account named
                  GuildHarbor using this setup key. Keep it private.
                </p>
                <code className="block break-all rounded border border-border p-3">
                  {new URL(uri).searchParams.get("secret")}
                </code>
                <label className="block text-sm">
                  Authenticator code
                  <input
                    className="field mt-2"
                    name="code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </label>
              </>
            ) : (
              <label className="block text-sm">
                Confirm password
                <input
                  className="field mt-2"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
            )}
            <button className="button-primary" disabled={totpPending}>
              {uri ? "Verify and enable 2FA" : "Set up authenticator"}
            </button>
          </form>
        )}
        <p
          role="status"
          className={totpState.error ? "text-danger" : "text-trust"}
        >
          {totpState.message}
        </p>
      </section>
    </div>
  );
}
