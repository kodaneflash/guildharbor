"use client";
import { useActionState, useState } from "react";
import { saveProfile } from "@/app/(product)/settings/profile/actions";

export type ProfileFormValues = {
  displayName: string; telegramHandle: string; discordHandle: string; bio: string;
  showTelegram: boolean; showDiscord: boolean; showLastSeen: boolean;
  preferredContact: string; locale: string; timezone: string;
};
export function ProfileForm({ values }: { values: ProfileFormValues }) {
  const [state, action, pending] = useActionState(saveProfile, { message: "" });
  const [timezone, setTimezone] = useState(values.timezone);
  const [suggestion, setSuggestion] = useState("");
  return <form action={action} className="surface space-y-5 p-6">
    <label className="block text-body-sm">Display name<input className="field mt-2" name="displayName" defaultValue={values.displayName} required maxLength={80} /></label>
    <label className="block text-body-sm">Telegram handle (optional)<input className="field mt-2" name="telegramHandle" defaultValue={values.telegramHandle} maxLength={33} /></label>
    <label className="flex gap-3 text-body-sm"><input type="checkbox" name="showTelegram" defaultChecked={values.showTelegram} />Share Telegram with eligible members</label>
    <label className="block text-body-sm">Discord username (optional)<input className="field mt-2" name="discordHandle" defaultValue={values.discordHandle} maxLength={32} /></label>
    <label className="flex gap-3 text-body-sm"><input type="checkbox" name="showDiscord" defaultChecked={values.showDiscord} />Share Discord with eligible members</label>
    <p className="text-body-sm text-text-muted">Contact details are private unless shared. Saving a handle does not connect notifications.</p>
    <label className="block text-body-sm">Preferred contact<select className="field mt-2" name="preferredContact" defaultValue={values.preferredContact}><option value="any">Any configured channel</option><option value="email">Email</option><option value="telegram">Telegram</option><option value="discord">Discord</option></select></label>
    <label className="block text-body-sm">Language<select className="field mt-2" name="locale" defaultValue={values.locale}><option value="en">English</option></select></label>
    <label className="block text-body-sm">IANA timezone<input className="field mt-2" name="timezone" value={timezone} onChange={event => setTimezone(event.target.value)} required maxLength={100} aria-describedby="timezone-help" /></label>
    <p id="timezone-help" className="text-body-sm text-text-muted">For example, UTC or America/New_York. Dates use this saved timezone.</p>
    <button type="button" className="button-secondary" onClick={() => setSuggestion(Intl.DateTimeFormat().resolvedOptions().timeZone)}>Detect browser timezone</button>
    {suggestion && <div className="flex flex-wrap items-center gap-3"><p role="status">Browser timezone: {suggestion}</p><button className="button-secondary" type="button" onClick={() => setTimezone(suggestion)}>Use {suggestion}</button></div>}
    <label className="flex gap-3 text-body-sm"><input type="checkbox" name="showLastSeen" defaultChecked={values.showLastSeen} />Share last-seen time with eligible members</label>
    <label className="block text-body-sm">About<textarea className="field mt-2 min-h-32" name="bio" defaultValue={values.bio} maxLength={1500} /></label>
    <p role="status">{state.message}</p><button className="button-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}
