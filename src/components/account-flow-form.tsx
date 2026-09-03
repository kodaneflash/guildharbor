"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

type Flow = "forgot" | "reset" | "username" | "two-factor";
type State = { message: string; error: boolean };
const initialState: State = { message: "", error: false };
const copy: Record<Flow, { title: string; description: string; submit: string }> = {
  forgot: { title: "Reset your password", description: "We’ll send a short-lived code if the account can be recovered.", submit: "Send reset code" },
  reset: { title: "Choose a new password", description: "Enter the code from your email and a new password.", submit: "Reset password" },
  username: { title: "Choose your username", description: "A unique username is required before entering GuildHarbor.", submit: "Complete onboarding" },
  "two-factor": { title: "Two-factor verification", description: "Enter the six-digit code from your authenticator app.", submit: "Verify code" },
};

export function AccountFlowForm({ flow, isConfigured }: { flow: Flow; isConfigured: boolean }) {
  async function submit(_: State, formData: FormData): Promise<State> {
    const email = String(formData.get("email") ?? ""); const otp = String(formData.get("otp") ?? ""); const password = String(formData.get("password") ?? ""); const username = String(formData.get("username") ?? "");
    const request = flow === "forgot" ? { path: "/api/auth/email-otp/request-password-reset", body: { email } } : flow === "reset" ? { path: "/api/auth/email-otp/reset-password", body: { email, otp, password } } : flow === "username" ? { path: "/api/auth/update-user", body: { username, displayUsername: username, name: username } } : { path: "/api/auth/two-factor/verify-totp", body: { code: otp, trustDevice: false } };
    const response = await fetch(request.path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.body) });
    if (!response.ok) return { error: true, message: "Unable to complete that request. Check the information and try again." };
    if (flow === "forgot") window.location.assign(`/reset-password?email=${encodeURIComponent(email)}`); else window.location.assign("/");
    return { error: false, message: "Request completed." };
  }
  const [state, action, pending] = useActionState(submit, initialState); const details = copy[flow];
  return <div className="site-container grid min-h-[calc(100vh-170px)] place-items-center py-10"><section className="surface w-full max-w-md p-5 sm:p-7"><h1 className="text-2xl font-extrabold text-text">{details.title}</h1><p className="mt-2 text-sm leading-6 text-text-muted">{details.description}</p><form action={action} className="mt-7 space-y-4">{(flow === "forgot" || flow === "reset") && <Field label="Email" name="email" type="email" autoComplete="email" />}{(flow === "reset" || flow === "two-factor") && <Field label="Verification code" name="otp" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} />}{flow === "reset" && <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} />}{flow === "username" && <Field label="Username" name="username" autoComplete="username" pattern="[A-Za-z0-9_.]+" minLength={3} maxLength={30} />}{!isConfigured && <p className="rounded-md border border-yellow/30 bg-yellow/10 p-3 text-xs leading-5 text-yellow">This flow becomes available when Neon and Better Auth are configured.</p>}{state.message && <p className={state.error ? "text-xs text-danger" : "text-xs text-trust"}>{state.message}</p>}<button className="button-primary w-full" disabled={!isConfigured || pending}>{pending && <LoaderCircle className="size-4 animate-spin" />}{details.submit}</button></form></section></div>;
}
function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { return <label className="block"><span className="mb-2 block text-xs font-bold text-text-secondary">{label}</span><input {...props} name={name} required className="field" /></label>; }
