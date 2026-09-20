"use client";
import { useActionState } from "react";
import { preferenceAction } from "@/app/(product)/settings/notifications/actions";
const types = [["message.received", "Private messages"], ["thread.reply", "Subscribed thread replies"], ["deal.updated", "Agreement updates"], ["support.updated", "Support updates"]] as const;
export function NotificationPreferences({ preferences }: { preferences: Array<{ eventType: string; inApp: boolean; email: boolean }> }) {
  const [state, action, pending] = useActionState(preferenceAction, { message: "" });
  return <form action={action} className="surface space-y-5 p-6">{types.map(([type, label]) => { const value = preferences.find(preference => preference.eventType === type); return <fieldset key={type} className="space-y-3 border-b border-border pb-4"><legend className="font-bold">{label}</legend><label className="flex gap-3"><input type="checkbox" name={`${type}.inApp`} defaultChecked={value?.inApp ?? true} />Show in notification inbox</label><label className="flex gap-3"><input type="checkbox" name={`${type}.email`} defaultChecked={value?.email ?? false} />Email notification</label></fieldset>; })}<p className="text-body-sm text-text-muted">Security and verification notices are mandatory. Event records are retained even when optional inbox display is off. Email contains no private message or delivery content. Telegram handles do not enable Telegram delivery.</p><button className="button-primary" disabled={pending}>Save preferences</button><p role="status">{state.message}</p></form>;
}
