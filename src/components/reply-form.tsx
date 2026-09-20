"use client";
import { useActionState } from "react";
import { replyAction } from "@/app/(product)/threads/reply-actions";
export function ReplyForm({ threadId }: { threadId: number }) {
  const [state, action, pending] = useActionState(
    replyAction.bind(null, threadId),
    { error: "" },
  );
  return (
    <form action={action} className="surface space-y-4 p-6">
      <label className="block font-bold">
        Reply
        <textarea
          name="content"
          className="field mt-3 min-h-32"
          required
          maxLength={20000}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      <button className="button-primary" disabled={pending}>
        Post reply
      </button>
    </form>
  );
}
