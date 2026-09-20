"use client";
import { useActionState, useState } from "react";
import { RecoveryCodes } from "@/components/account-security-controls";
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
  const [disableState, disableAction, disablePending] = useActionState(async (_: State, form: FormData): Promise<State> => {
    const result = await authClient.twoFactor.disable({ password: String(form.get("password")) });
    if (result.error) return { error: true, message: result.error.message ?? "Unable to disable the authenticator." };
    setEnabled(false);
    return { error: false, message: "Two-factor authentication disabled. Existing recovery codes no longer work." };
  }, { message: "", error: false });
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
        <h2 className="text-heading-lg font-bold">Change password</h2>
        <label className="block text-body-sm">
          Current password
          <input
            className="field mt-2"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label className="block text-body-sm">
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
        <h2 className="text-heading-lg font-bold">Two-factor authentication</h2>
        {isEnabled ? (
          <form action={disableAction} className="space-y-4"><p className="text-trust">An authenticator is enrolled.</p><p>Disabling removes the additional sign-in check and invalidates its recovery codes.</p><label className="block">Confirm password<input className="field mt-2" name="password" type="password" autoComplete="current-password" required /></label><button className="button-secondary" disabled={disablePending}>Disable authenticator</button></form>
        ) : (
          <form action={totpAction} className="space-y-4">
            {uri ? (
              <>
                <p className="text-body-sm text-text-muted">
                  In your authenticator, add a time-based account named
                  GuildHarbor using this setup key. Keep it private.
                </p>
                <code className="block break-all rounded border border-border p-3">
                  {new URL(uri).searchParams.get("secret")}
                </code>
                <label className="block text-body-sm">
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
              <label className="block text-body-sm">
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
      <p role="status" className={disableState.error ? "text-danger" : "text-trust"}>{disableState.message}</p>
      <RecoveryCodes enabled={isEnabled} />
    </div>
  );
}
