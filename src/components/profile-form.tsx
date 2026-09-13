"use client";
import { useActionState } from "react";
import { saveProfile } from "@/app/settings/profile/actions";
export function ProfileForm({
  displayName,
  telegramHandle,
  bio,
}: {
  displayName: string;
  telegramHandle: string;
  bio: string;
}) {
  const [state, action, pending] = useActionState(saveProfile, { message: "" });
  return (
    <form action={action} className="surface space-y-5 p-6">
      <label className="block text-sm">
        Display name
        <input
          className="field mt-2"
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={80}
        />
      </label>
      <label className="block text-sm">
        Telegram handle (optional)
        <input
          className="field mt-2"
          name="telegramHandle"
          defaultValue={telegramHandle}
          maxLength={33}
        />
      </label>
      <label className="block text-sm">
        About
        <textarea
          className="field mt-2 min-h-32"
          name="bio"
          defaultValue={bio}
          maxLength={1500}
        />
      </label>
      <p role="status">{state.message}</p>
      <button className="button-primary" disabled={pending}>
        Save profile
      </button>
    </form>
  );
}
