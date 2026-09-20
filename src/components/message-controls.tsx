"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { composeAction, conversationAction, sendAction } from "@/app/(product)/messages/actions";
export function ComposeConversation({ username = "" }: { username?: string }) {
  const [state, action, pending] = useActionState(composeAction, { message: "" });
  return <form action={action} className="space-y-3"><label className="block">Message a member<input className="field mt-2" name="username" defaultValue={username} minLength={3} maxLength={30} required /></label><button className="button-primary" disabled={pending}>Open conversation</button><p role="status">{state.message}</p></form>;
}
export function MessageComposer({ conversationId, requestId }: { conversationId: string; requestId: string }) {
  const [state, action, pending] = useActionState(sendAction, { message: "", sent: false });
  return <form action={action} className="space-y-3"><input type="hidden" name="conversationId" value={conversationId} /><input type="hidden" name="requestId" value={requestId} /><label className="block">Message<textarea className="field mt-2 min-h-32" name="text" required maxLength={20000} /></label><label className="block text-body-sm">Reply to message number (optional)<input className="field mt-2" name="replyToId" inputMode="numeric" pattern="[0-9]+" /></label><button className="button-primary" disabled={pending}>Send message</button><p role="status">{state.message}</p></form>;
}
export function ConversationControls({ id, direct, archived, muted, latestId }: { id: string; direct: boolean; archived: boolean; muted: boolean; latestId?: number }) {
  const [state, action, pending] = useActionState(conversationAction, { message: "" });
  return <details><summary className="cursor-pointer">Conversation controls</summary><form action={action} className="mt-3 space-y-3"><input type="hidden" name="conversationId" value={id} /><div className="flex flex-wrap gap-2"><button className="button-secondary" name="operation" value={archived ? "restore" : "archive"} disabled={pending}>{archived ? "Restore" : "Archive"}</button><button className="button-secondary" name="operation" value={muted ? "unmute" : "mute"} disabled={pending}>{muted ? "Unmute" : "Mute"}</button>{direct && <><button className="button-secondary" name="operation" value="block" disabled={pending}>Block direct contact</button><button className="button-secondary" name="operation" value="unblock" disabled={pending}>Unblock</button></>}</div><label className="block">Message number to report<input className="field mt-2" name="messageId" type="number" min={1} defaultValue={latestId} /></label><label className="block">Report reason<textarea className="field mt-2" name="reason" maxLength={2000} /></label><button className="button-secondary" name="operation" value="report" disabled={pending}>Report message and open support case</button><p role="status">{state.message}</p></form></details>;
}
export function ConversationPolling({ conversationId, latestId }: { conversationId: string; latestId?: number }) {
  const [error, setError] = useState("");
  const router = useRouter(); const lastRead = useRef<number | undefined>(undefined);
  useEffect(() => {
    async function markRead() {
      if (!latestId || document.visibilityState !== "visible" || lastRead.current === latestId) return;
      const form = new FormData(); form.set("conversationId", conversationId); form.set("operation", "read"); form.set("messageId", String(latestId));
      try {
        await conversationAction({ message: "" }, form);
        lastRead.current = latestId;
        setError("");
      } catch {
        setError("Could not update your read status. It will retry while this conversation is visible.");
      }
    }
    void markRead();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") { router.refresh(); void markRead(); } }, 20000);
    return () => window.clearInterval(timer);
  }, [conversationId, latestId, router]);
  return error ? <p role="status" className="text-body-sm text-text-muted">{error}</p> : null;
}
