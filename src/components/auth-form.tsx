"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { UsernameField } from "@/components/username-field";
import { Turnstile } from "@/components/turnstile";
import { PendingReview } from "@/components/access-notice-client";
import { TelegramBadge } from "@/components/telegram-badge";
import { authClient } from "@/lib/auth-client";

type AuthState = { status: "idle" | "error" | "success"; message: string };
const initialState: AuthState = { status: "idle", message: "" };

async function parseError(response: Response) {
  const payload: object = await response.json().catch(() => ({}));
  if ("message" in payload && typeof payload.message === "string")
    return payload.message;
  return "Unable to complete that request. Check your details and try again.";
}

type SocialProviderConfiguration = {
  isGoogleConfigured: boolean;
};

type SignUpFormProps = SocialProviderConfiguration & {
  isConfigured: boolean;
  requiresApproval?: boolean;
  returnTo?: string;
};

export function SignUpForm({
  requiresApproval = true,
  returnTo = "/",
  isConfigured,
  isGoogleConfigured,
}: SignUpFormProps) {
  const [token, setToken] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [registered, setRegistered] = useState<string | null>(null);
  async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
    const username = String(formData.get("username") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const response = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-turnstile-token": token,
      },
      body: JSON.stringify({
        name: username,
        username,
        displayUsername: username,
        email,
        password,
      }),
    });
    setAttempt((value) => value + 1);
    if (!response.ok)
      return { status: "error", message: await parseError(response) };
    setRegistered(email);
    return {
      status: "success",
      message: "Check your email for a verification code.",
    };
  }

  const [state, action, isPending] = useActionState(signUp, initialState);
  if (registered)
    return (
      <div className="site-container space-y-4 py-12">
        {requiresApproval ? <PendingReview /> : <section className="surface mx-auto max-w-xl space-y-4 p-7"><h1 className="text-heading-xl">Verify your email</h1><p>Verify your email, then sign in to join the community.</p></section>}
        <p className="text-center">
          <Link
            className="button-primary"
            href={`/verify-email?email=${encodeURIComponent(registered)}&returnTo=${encodeURIComponent(returnTo)}`}
          >
            Verify your email
          </Link>
        </p>
      </div>
    );
  return (
    <AuthCard
      title="Create your account"
      description="A verified email and unique username are required."
    >
      <form action={action} className="space-y-4">
        <UsernameField />
        <AuthField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
        />
        <AuthField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
        />
        <Turnstile onToken={setToken} attempt={attempt} />
        <Status state={state} isConfigured={isConfigured} />
        <button
          className="button-primary w-full"
          type="submit"
          disabled={
            !isConfigured ||
            isPending ||
            Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !token)
          }
        >
          {isPending && <LoaderCircle className="size-4 animate-spin" />} Create
          account
        </button>
      </form>
      <SocialButtons
        isGoogleConfigured={isConfigured && isGoogleConfigured}
        returnTo={returnTo}
        verb="Continue"
        token={token}
        onAttempt={() => setAttempt((value) => value + 1)}
      />
      <p className="text-center text-body-xs text-text-muted">
        Already a member?{" "}
        <Link href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-category">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

type SignInFormProps = SocialProviderConfiguration & {
  returnTo?: string;
  isConfigured: boolean;
};

export function SignInForm({
  returnTo = "/",
  isConfigured,
  isGoogleConfigured,
}: SignInFormProps) {
  async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: returnTo,
    });
    if (result.error)
      return { status: "error", message: "Email or password is incorrect." };
    if (
      result.data &&
      "twoFactorRedirect" in result.data &&
      result.data.twoFactorRedirect
    )
      return {
        status: "success",
        message: "Continue with two-factor verification.",
      };
    window.location.assign(returnTo);
    return { status: "success", message: "Signed in." };
  }

  const [state, action, isPending] = useActionState(signIn, initialState);
  return (
    <AuthCard accessibleName="Sign in" frameless>
      <form action={action} className="space-y-4">
        <AuthField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
        />
        <AuthField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-body-xs font-semibold text-category"
          >
            Forgot password?
          </Link>
        </div>
        <Status state={state} isConfigured={isConfigured} />
        <button
          className="button-primary w-full"
          type="submit"
          disabled={!isConfigured || isPending}
        >
          {isPending && <LoaderCircle className="size-4 animate-spin" />} Sign
          in
        </button>
      </form>
      <SocialButtons
        isGoogleConfigured={isConfigured && isGoogleConfigured}
        verb="Sign in"
        returnTo={returnTo}
      />
      <p className="text-center text-body-xs text-text-muted">
        New here?{" "}
        <Link href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-category">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export function VerifyEmailForm({
  isConfigured,
  email,
  returnTo = "/",
}: {
  isConfigured: boolean;
  email: string;
  returnTo?: string;
}) {
  async function verify(_: AuthState, formData: FormData): Promise<AuthState> {
    const otp = String(formData.get("otp") ?? "");
    const response = await fetch("/api/auth/email-otp/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    if (!response.ok)
      return { status: "error", message: await parseError(response) };
    window.location.assign(returnTo);
    return { status: "success", message: "Email verified." };
  }
  const [state, action, isPending] = useActionState(verify, initialState);
  const [resendState, resendAction, resending] = useActionState(
    async (): Promise<AuthState> => {
      const response = await fetch(
        "/api/auth/email-otp/send-verification-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, type: "email-verification" }),
        },
      );
      return response.ok
        ? {
            status: "success",
            message: "A new verification code has been requested.",
          }
        : { status: "error", message: await parseError(response) };
    },
    initialState,
  );
  return (
    <AuthCard
      title="Verify your email"
      description={`Enter the six-digit code sent to ${email || "your email"}.`}
    >
      <form action={action} className="space-y-4">
        <AuthField
          label="Verification code"
          name="otp"
          inputMode="numeric"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
        />
        <Status state={state} isConfigured={isConfigured} />
        <button
          className="button-primary w-full"
          disabled={!isConfigured || !email || isPending}
        >
          {isPending && <LoaderCircle className="size-4 animate-spin" />} Verify
          email
        </button>
      </form>
      <form action={resendAction}>
        <button
          className="button-secondary w-full"
          disabled={!isConfigured || !email || resending}
        >
          Resend verification code
        </button>
        <Status state={resendState} isConfigured={isConfigured} />
      </form>
      <p className="text-center text-body-xs text-text-muted">
        Codes expire after five minutes and allow three attempts.
      </p>
    </AuthCard>
  );
}

type SocialButtonsProps = SocialProviderConfiguration & {
  returnTo?: string;
  verb: "Continue" | "Sign in";
  token?: string;
  onAttempt?: () => void;
};

function SocialButtons({
  returnTo = "/",
  isGoogleConfigured,
  verb,
  token,
  onAttempt,
}: SocialButtonsProps) {
  const [socialToken, setSocialToken] = useState("");
  const [socialAttempt, setSocialAttempt] = useState(0);
  const [socialError, setSocialError] = useState("");
  const blocked = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !(token ?? socialToken),
  );
  async function startSocialSignIn(provider: "google") {
    const result = await authClient.signIn.social({
      provider,
      callbackURL: `/onboarding/username?returnTo=${encodeURIComponent(returnTo)}`,
      newUserCallbackURL: `/onboarding/username?returnTo=${encodeURIComponent(returnTo)}`,
      errorCallbackURL: "/sign-in?error=oauth",
      fetchOptions: { headers: { "x-turnstile-token": token ?? socialToken } },
    });
    if (result.error) {
      setSocialError(result.error.message ?? "Unable to sign in.");
      onAttempt?.();
      setSocialAttempt((value) => value + 1);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 text-label-sm uppercase tracking-wider text-text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      {token === undefined && (
        <Turnstile onToken={setSocialToken} attempt={socialAttempt} />
      )}
      {socialError && (
        <p role="alert" className="text-body-xs text-danger">
          {socialError}
        </p>
      )}
      <div className="flex justify-center">
        <button
          className="button-secondary min-w-52 px-6"
          disabled={!isGoogleConfigured || blocked}
          type="button"
          onClick={() => startSocialSignIn("google")}
        >
          <span
            aria-hidden="true"
            className="grid size-4 place-items-center text-body-sm font-semibold"
          >
            G
          </span>
          {verb} with Google
        </button>
      </div>
    </>
  );
}

function AuthCard({
  title,
  description,
  children,
  frameless = false,
  accessibleName,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  frameless?: boolean;
  accessibleName?: string;
}) {
  return (
    <div className="site-container grid min-h-screen place-items-center py-10">
      <section
        aria-label={accessibleName}
        className={`${frameless ? "" : "surface "}w-full max-w-md p-5 sm:p-7`}
      >
        <TelegramBadge />
        {title && (
          <h1 className="mt-4 text-heading-xl text-text">
            {title}
          </h1>
        )}
        {description && (
          <p className="mt-2 text-body-sm leading-6 text-text-muted">
            {description}
          </p>
        )}
        <div className="mt-7 space-y-5">{children}</div>
      </section>
    </div>
  );
}

function Status({
  state,
  isConfigured,
}: {
  state: AuthState;
  isConfigured: boolean;
}) {
  if (!isConfigured)
    return (
      <p
        role="status"
        className="rounded-md border border-yellow/30 bg-yellow/10 p-3 text-body-xs leading-5 text-yellow"
      >
        Registration and sign-in are temporarily unavailable.
      </p>
    );
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className={
        state.status === "error" ? "text-body-xs text-danger" : "text-body-xs text-trust"
      }
    >
      {state.message}
    </p>
  );
}

type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
};
function AuthField({ label, name, placeholder = label, ...props }: AuthFieldProps) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        {...props}
        name={name}
        placeholder={placeholder}
        required
        className="auth-field"
      />
    </label>
  );
}
