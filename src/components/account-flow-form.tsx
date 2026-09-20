"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { UsernameField } from "@/components/username-field";

type Flow = "forgot" | "reset" | "username" | "two-factor";
type State = { message: string; error: boolean };
const initialState: State = { message: "", error: false };
const copy: Record<
  Flow,
  { title: string; description: string; submit: string }
> = {
  forgot: {
    title: "Reset your password",
    description:
      "We’ll send a short-lived code if the account can be recovered.",
    submit: "Send reset code",
  },
  reset: {
    title: "Choose a new password",
    description: "Enter the code from your email and a new password.",
    submit: "Reset password",
  },
  username: {
    title: "Choose your username",
    description: "A unique username is required before entering GuildHarbor.",
    submit: "Complete onboarding",
  },
  "two-factor": {
    title: "Two-factor verification",
    description: "Enter the six-digit code from your authenticator app.",
    submit: "Verify code",
  },
};

export function AccountFlowForm({
  flow,
  isConfigured,
  returnTo = "/",
}: {
  flow: Flow;
  returnTo?: string;
  isConfigured: boolean;
}) {
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  async function submit(_: State, formData: FormData): Promise<State> {
    const email = String(formData.get("email") ?? "");
    const otp = String(formData.get("otp") ?? "");
    const password = String(formData.get("password") ?? "");
    const username = String(formData.get("username") ?? "");
    const request =
      flow === "forgot"
        ? {
            path: "/api/auth/email-otp/request-password-reset",
            body: { email },
          }
        : flow === "reset"
          ? {
              path: "/api/auth/email-otp/reset-password",
              body: { email, otp, password },
            }
          : flow === "username"
            ? {
                path: "/api/auth/update-user",
                body: { username, displayUsername: username, name: username },
              }
            : {
                path: useRecoveryCode ? "/api/auth/two-factor/verify-backup-code" : "/api/auth/two-factor/verify-totp",
                body: { code: otp, trustDevice: false },
              };
    const response = await fetch(request.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
    if (!response.ok)
      return {
        error: true,
        message:
          "Unable to complete that request. Check the information and try again.",
      };
    if (flow === "forgot")
      window.location.assign(
        `/reset-password?email=${encodeURIComponent(email)}`,
      );
    else window.location.assign(returnTo);
    return { error: false, message: "Request completed." };
  }
  const [state, action, pending] = useActionState(submit, initialState);
  const details = copy[flow];
  return (
    <div className="site-container grid min-h-[calc(100vh-170px)] place-items-center py-10">
      <section className="surface w-full max-w-md p-5 sm:p-7">
        <h1 className="text-heading-xl font-extrabold text-text">{details.title}</h1>
        <p className="mt-2 text-body-sm leading-6 text-text-muted">
          {details.description}
        </p>
        <form action={action} className="mt-7 space-y-4">
          {(flow === "forgot" || flow === "reset") && (
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
            />
          )}
          {(flow === "reset" || flow === "two-factor") && (
            <Field
              label="Verification code"
              name="otp"
              inputMode="numeric"
              pattern={useRecoveryCode ? undefined : "[0-9]{6}"}
              minLength={6}
              maxLength={useRecoveryCode ? 32 : 6}
            />
          )}
          {flow === "two-factor" && <label className="flex gap-3 text-body-sm"><input type="checkbox" checked={useRecoveryCode} onChange={event => setUseRecoveryCode(event.target.checked)} />Use a recovery code</label>}
          {flow === "reset" && (
            <Field
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
            />
          )}
          {flow === "username" && <UsernameField />}
          {!isConfigured && (
            <p className="rounded-md border border-yellow/30 bg-yellow/10 p-3 text-body-xs leading-5 text-yellow">
              This account service is temporarily unavailable.
            </p>
          )}
          {state.message && (
            <p
              role="status"
              className={
                state.error ? "text-body-xs text-danger" : "text-body-xs text-trust"
              }
            >
              {state.message}
            </p>
          )}
          <button
            className="button-primary w-full"
            disabled={!isConfigured || pending}
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {details.submit}
          </button>
        </form>
      </section>
    </div>
  );
}
function Field({
  label,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-body-xs font-bold text-text-secondary">
        {label}
      </span>
      <input {...props} name={name} required className="field" />
    </label>
  );
}
