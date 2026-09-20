"use client";
import { useActionState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { createThreadAction } from "@/app/(product)/threads/new/actions";
export function NewThreadForm({
  forums,
  selected,
}: {
  forums: { slug: string; title: string }[];
  selected?: string;
}) {
  const [state, action, pending] = useActionState(createThreadAction, {
    error: "",
  });
  return (
    <form action={action} className="surface space-y-5 p-5 sm:p-7">
      <label className="block">
        <span className="mb-2 block text-body-xs font-bold">Forum</span>
        <select className="field" name="forum" defaultValue={selected}>
          {forums.map((forum) => (
            <option key={forum.slug} value={forum.slug}>
              {forum.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-body-xs font-bold">Title</span>
        <input
          className="field"
          name="title"
          minLength={5}
          maxLength={160}
          required
        />
      </label>
      <RichTextEditor />
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      <button className="button-primary" disabled={pending}>
        Publish thread
      </button>
    </form>
  );
}
