"use client";
import { useActionState, useState } from "react";
import { authClient } from "@/lib/auth-client";

type State = { message: string };
export function SessionControls() {
  const [sessions, setSessions] = useState<Array<{ token: string; createdAt: Date; userAgent?: string | null }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [state, action, pending] = useActionState(async (_: State, form: FormData) => {
    const operation = form.get("operation");
    if (operation === "revoke") {
      const result = await authClient.revokeSession({ token: String(form.get("token")) });
      if (result.error) return { message: result.error.message ?? "Unable to revoke session." };
    }
    if (operation === "others") {
      const result = await authClient.revokeOtherSessions();
      if (result.error) return { message: result.error.message ?? "Unable to revoke other sessions." };
    }
    const result = await authClient.listSessions();
    if (result.error) return { message: result.error.message ?? "Unable to load sessions. Sign in again if this session was revoked." };
    setSessions(result.data); setLoaded(true);
    return { message: operation === "load" ? "Sessions loaded." : "Session access revoked." };
  }, { message: "" });
  return <section className="surface space-y-4 p-6"><h2 className="text-heading-lg font-bold">Signed-in sessions</h2><form action={action} className="flex flex-wrap gap-3"><button className="button-secondary" name="operation" value="load" disabled={pending}>Refresh sessions</button><button className="button-secondary" name="operation" value="others" disabled={pending}>Sign out other sessions</button></form>{loaded && !sessions.length && <p>No active sessions.</p>}{sessions.map(session => <form action={action} key={session.token} className="space-y-2 border-t border-border pt-3"><p className="break-words text-body-sm">{session.userAgent || "Unreported device"}</p><p className="text-body-xs text-text-muted">Created {new Date(session.createdAt).toISOString()}</p><input type="hidden" name="token" value={session.token} /><button className="button-secondary" name="operation" value="revoke" disabled={pending}>Revoke this session</button></form>)}<p role="status">{state.message}</p></section>;
}
export function RecoveryCodes({ enabled }: { enabled: boolean }) {
  const [codes, setCodes] = useState<string[]>([]);
  const [state, action, pending] = useActionState(async (_: State, form: FormData) => {
    const result = await authClient.twoFactor.generateBackupCodes({ password: String(form.get("password")) });
    if (result.error) return { message: result.error.message ?? "Unable to regenerate recovery codes." };
    setCodes(result.data.backupCodes);
    return { message: "New recovery codes generated. Previous codes no longer work. Save these privately before leaving this page." };
  }, { message: "" });
  if (!enabled) return null;
  return <section className="surface space-y-4 p-6"><h2 className="text-heading-lg font-bold">Recovery codes</h2><p>Each code works once in place of an authenticator code.</p><form action={action} className="space-y-3"><label className="block">Confirm password<input className="field mt-2" name="password" type="password" autoComplete="current-password" required /></label><button className="button-secondary" disabled={pending}>Replace recovery codes</button></form><p role="status">{state.message}</p>{codes.length > 0 && <><ul className="grid gap-2 sm:grid-cols-2">{codes.map(code => <li key={code}><code>{code}</code></li>)}</ul><button type="button" className="button-secondary" onClick={() => setCodes([])}>I saved my codes — hide them</button></>}</section>;
}
export function EmailChange({ email }: { email: string }) {
  const [step, setStep] = useState<"current" | "request" | "confirm" | "done">("current");
  const [newEmail, setNewEmail] = useState("");
  const [state, action, pending] = useActionState(async (_: State, form: FormData) => {
    const destination = String(form.get("newEmail") ?? newEmail);
    const request = step === "current" ? { path: "send-verification-otp", body: { email, type: "email-verification" } } : step === "request" ? { path: "request-email-change", body: { newEmail: destination, otp: String(form.get("otp")) } } : { path: "change-email", body: { newEmail, otp: String(form.get("otp")) } };
    const response = await fetch(`/api/auth/email-otp/${request.path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.body) });
    if (!response.ok) return { message: "Email change failed. Check the address and code, or restart for a fresh code." };
    if (step === "current") { setStep("request"); return { message: "Verification code sent to your current email." }; }
    if (step === "request") { setNewEmail(destination); setStep("confirm"); return { message: "Enter the code sent to your new email address." }; }
    setStep("done"); return { message: "Your new email has been verified and saved. Use it next time you sign in." };
  }, { message: "" });
  return <section className="surface space-y-4 p-6"><h2 className="text-heading-lg font-bold">Change email</h2><p className="break-all">Current verified email: {step === "done" ? newEmail : email}</p><p className="text-body-sm text-text-muted">Both your current and new address must be verified. Your existing email stays active until verification succeeds.</p>{step !== "done" && <form action={action} className="space-y-3">{step === "request" && <label className="block">New email<input className="field mt-2" name="newEmail" type="email" autoComplete="email" required /></label>}{step !== "current" && <label className="block">{step === "request" ? "Current email code" : "New email code"}<input className="field mt-2" name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label>}<button className="button-primary" disabled={pending}>{step === "current" ? "Verify current email" : step === "request" ? "Verify and send new email code" : "Confirm email change"}</button></form>}<p role="status">{state.message}</p>{step !== "current" && step !== "done" && <button className="button-secondary" type="button" disabled={pending} onClick={() => setStep("current")}>Restart verification</button>}</section>;
}
