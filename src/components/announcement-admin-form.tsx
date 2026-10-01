"use client";
import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import type { RichTextDocument } from "@/lib/rich-text";
import { RichTextEditor } from "@/components/rich-text-editor";
import { saveAnnouncementAction, removeAnnouncementAction } from "@/app/(product)/admin/announcements/actions";

type FormProps = { id: string; value?: { title: string; content: RichTextDocument; pinned: boolean; important: boolean } };

export function AnnouncementAdminForm(props: FormProps) {
  const [submissionId, setSubmissionId] = useState(props.id);
  return <AnnouncementForm key={submissionId} {...props} id={submissionId} onNew={() => setSubmissionId(crypto.randomUUID())} />;
}

function AnnouncementForm({ id: submissionId, value, onNew }: FormProps & { onNew: () => void }) {
  const [state, action, pending] = useActionState(saveAnnouncementAction.bind(null, value ? "edit" : "publish"), { error: "", message: "" });
  if (state.published) return <div className="surface space-y-4 p-5">
    <p role="status">{state.message}</p>
    <Link className="text-category hover:underline" href={`/announcements/${submissionId}`}>View announcement</Link>
    <button type="button" className="button-secondary" onClick={onNew}>Publish another announcement</button>
  </div>;
  return <form method="post" onSubmit={event => {
    // Dispatch explicitly so React does not reset the editor/title after validation errors.
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  }} className="surface space-y-4 p-5">
    <input type="hidden" name="id" value={submissionId} />
    <label className="block space-y-2"><span className="font-semibold">Title</span><input className="field" name="title" required maxLength={160} defaultValue={value?.title} /></label>
    <fieldset className="space-y-2"><legend className="mb-2 font-semibold">Announcement content</legend><RichTextEditor label="Announcement content" initialContent={value?.content} /></fieldset>
    <div className="flex flex-wrap gap-5">
      <label className="flex items-center gap-2"><input type="checkbox" name="pinned" defaultChecked={value?.pinned} />Pinned</label>
      <label className="flex items-center gap-2"><input type="checkbox" name="important" defaultChecked={value?.important} />Important</label>
    </div>
    <p className="text-body-sm text-text-muted">{value ? "Changes update the post without sending another Telegram alert." : "Publishing queues Telegram alerts for connected members with Announcements enabled."}</p>
    {state.error && <p role="alert" className="text-danger">{state.error}</p>}
    <button className="button-primary" disabled={pending}>{pending ? "Saving…" : value ? "Save changes" : "Publish announcement"}</button>
    {!state.error && <p role="status">{state.message}</p>}
  </form>;
}

export function AnnouncementRemovalForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeAnnouncementAction, { error: "", message: "" });
  return <form action={action} className="space-y-3 border-t border-border p-5">
    <input type="hidden" name="id" value={id} />
    <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" name="confirm" required />Remove this announcement from home and the archive. Pending Telegram alerts will be skipped.</label>
    <button className="button-secondary text-danger" disabled={pending}>{pending ? "Removing…" : "Remove announcement"}</button>
    {state.error && <p role="alert" className="text-danger">{state.error}</p>}
    <p role="status">{state.message}</p>
  </form>;
}
