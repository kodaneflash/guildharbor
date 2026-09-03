"use client";

import { Apple, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { authClient } from "@/lib/auth-client";

type AuthState = { status: "idle" | "error" | "success"; message: string };
const initialState: AuthState = { status: "idle", message: "" };

async function parseError(response: Response) {
  const payload: object = await response.json().catch(() => ({}));
  if ("message" in payload && typeof payload.message === "string") return payload.message;
  return "Unable to complete that request. Check your details and try again.";
}

type SocialProviderConfiguration = {
  isAppleConfigured: boolean;
  isGoogleConfigured: boolean;
};

type SignUpFormProps = SocialProviderConfiguration & {
  isConfigured: boolean;
};

export function SignUpForm({
  isAppleConfigured,
  isConfigured,
  isGoogleConfigured,
}: SignUpFormProps) {
  async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
    const username = String(formData.get("username") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const response = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: username, username, displayUsername: username, email, password }),
    });
    if (!response.ok) return { status: "error", message: await parseError(response) };
    window.location.assign(`/verify-email?email=${encodeURIComponent(email)}`);
    return { status: "success", message: "Check your email for a verification code." };
  }

  const [state, action, isPending] = useActionState(signUp, initialState);
  return (
    <AuthCard title="Create your account" description="A verified email and unique username are required.">
      <form action={action} className="space-y-4">
        <AuthField icon={UserRound} label="Username" name="username" autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]+" />
        <AuthField icon={Mail} label="Email" name="email" type="email" autoComplete="email" />
        <AuthField icon={LockKeyhole} label="Password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} />
        <Status state={state} isConfigured={isConfigured} />
        <button className="button-primary w-full" type="submit" disabled={!isConfigured || isPending}>{isPending && <LoaderCircle className="size-4 animate-spin" />} Create account</button>
      </form>
      <SocialButtons
        isAppleConfigured={isConfigured && isAppleConfigured}
        isGoogleConfigured={isConfigured && isGoogleConfigured}
        verb="Continue"
      />
      <p className="text-center text-xs text-text-muted">Already a member? <Link href="/sign-in" className="font-bold text-category">Sign in</Link></p>
    </AuthCard>
  );
}

type SignInFormProps = SocialProviderConfiguration & {
  isConfigured: boolean;
};

export function SignInForm({
  isAppleConfigured,
  isConfigured,
  isGoogleConfigured,
}: SignInFormProps) {
  async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const result = await authClient.signIn.email({ email, password, callbackURL: "/" });
    if (result.error) return { status: "error", message: "Email or password is incorrect." };
    window.location.assign(result.data?.url ?? "/");
    return { status: "success", message: "Signed in." };
  }

  const [state, action, isPending] = useActionState(signIn, initialState);
  return (
    <AuthCard title="Welcome back" description="Sign in with your verified email and password.">
      <form action={action} className="space-y-4">
        <AuthField icon={Mail} label="Email" name="email" type="email" autoComplete="email" />
        <AuthField icon={LockKeyhole} label="Password" name="password" type="password" autoComplete="current-password" />
        <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-bold text-category">Forgot password?</Link></div>
        <Status state={state} isConfigured={isConfigured} />
        <button className="button-primary w-full" type="submit" disabled={!isConfigured || isPending}>{isPending && <LoaderCircle className="size-4 animate-spin" />} Sign in</button>
      </form>
      <SocialButtons
        isAppleConfigured={isConfigured && isAppleConfigured}
        isGoogleConfigured={isConfigured && isGoogleConfigured}
        verb="Sign in"
      />
      <p className="text-center text-xs text-text-muted">New here? <Link href="/sign-up" className="font-bold text-category">Create an account</Link></p>
    </AuthCard>
  );
}

export function VerifyEmailForm({ isConfigured, email }: { isConfigured: boolean; email: string }) {
  async function verify(_: AuthState, formData: FormData): Promise<AuthState> {
    const otp = String(formData.get("otp") ?? "");
    const response = await fetch("/api/auth/email-otp/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, otp }) });
    if (!response.ok) return { status: "error", message: await parseError(response) };
    window.location.assign("/");
    return { status: "success", message: "Email verified." };
  }
  const [state, action, isPending] = useActionState(verify, initialState);
  return <AuthCard title="Verify your email" description={`Enter the six-digit code sent to ${email || "your email"}.`}><form action={action} className="space-y-4"><AuthField icon={LockKeyhole} label="Verification code" name="otp" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} /><Status state={state} isConfigured={isConfigured} /><button className="button-primary w-full" disabled={!isConfigured || !email || isPending}>{isPending && <LoaderCircle className="size-4 animate-spin" />} Verify email</button></form><p className="text-center text-xs text-text-muted">Codes expire after five minutes and allow three attempts.</p></AuthCard>;
}

type SocialButtonsProps = SocialProviderConfiguration & {
  verb: "Continue" | "Sign in";
};

function SocialButtons({
  isAppleConfigured,
  isGoogleConfigured,
  verb,
}: SocialButtonsProps) {
  function startSocialSignIn(provider: "apple" | "google") {
    void authClient.signIn.social({
      provider,
      callbackURL: "/onboarding/username",
      newUserCallbackURL: "/onboarding/username",
      errorCallbackURL: "/sign-in?error=oauth",
    });
  }

  return (
    <>
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-2">
        <button
          className="button-secondary w-full"
          disabled={!isGoogleConfigured}
          type="button"
          onClick={() => startSocialSignIn("google")}
        >
          <span aria-hidden="true" className="grid size-4 place-items-center text-sm font-black">G</span>
          {verb} with Google
        </button>
        <button
          className="button-secondary w-full"
          disabled={!isAppleConfigured}
          type="button"
          onClick={() => startSocialSignIn("apple")}
        >
          <Apple className="size-4" />
          {verb} with Apple
        </button>
      </div>
      {(!isGoogleConfigured || !isAppleConfigured) && (
        <p className="text-center text-[11px] leading-5 text-text-muted">
          Social sign-in becomes available after its provider credentials are configured.
        </p>
      )}
    </>
  );
}

function AuthCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="site-container grid min-h-[calc(100vh-170px)] place-items-center py-10"><section className="surface w-full max-w-md p-5 sm:p-7"><h1 className="text-2xl font-extrabold text-text">{title}</h1><p className="mt-2 text-sm leading-6 text-text-muted">{description}</p><div className="mt-7 space-y-5">{children}</div></section></div>;
}

function Status({ state, isConfigured }: { state: AuthState; isConfigured: boolean }) {
  if (!isConfigured) return <p role="status" className="rounded-md border border-yellow/30 bg-yellow/10 p-3 text-xs leading-5 text-yellow">Authentication is disabled in this preview. Add the documented Neon and Better Auth environment variables to enable it.</p>;
  if (state.status === "idle") return null;
  return <p role="status" className={state.status === "error" ? "text-xs text-danger" : "text-xs text-trust"}>{state.message}</p>;
}

type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & { icon: typeof Mail; label: string; name: string };
function AuthField({ icon: Icon, label, name, ...props }: AuthFieldProps) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-text-secondary">{label}</span><span className="relative block"><Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><input {...props} name={name} required className="field pl-10" /></span></label>;
}
