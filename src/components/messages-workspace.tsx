"use client";

import { Archive, Flag, ImagePlus, Paperclip, Reply, Search, Send, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";

import { UserAvatar } from "@/components/user-avatar";

type OptimisticMessage = { id: string; body: string; mine: boolean; pending?: boolean };
const conversations = [
  { id: "demo", username: "Juniper", preview: "That scope works for our team.", time: "1m", unread: 1, seed: "JU" },
  { id: "mira", username: "Mira", preview: "Thanks for the detailed report.", time: "2h", unread: 0, seed: "MI" },
  { id: "rowan", username: "Rowan", preview: "I added the updated files.", time: "Mon", unread: 0, seed: "RW" },
];

export function MessagesWorkspace({ activeId }: { activeId?: string }) {
  const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const [messages, setMessages] = useState<OptimisticMessage[]>([
    { id: "1", body: "Hi! I’m interested in the design-system review. Could you share how you normally scope it?", mine: false },
    { id: "2", body: "Absolutely. I start with a written inventory, team size, and the top two outcomes. From there I can suggest a fixed scope before any work begins.", mine: true },
    { id: "3", body: "That scope works for our team.", mine: false },
  ]);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(messages, (current, message: OptimisticMessage) => [...current, message]);
  const [isPending, startTransition] = useTransition();

  function sendMessage(formData: FormData) {
    const body = String(formData.get("message") ?? "").trim();
    if (!body) return;
    startTransition(() => {
      const message = { id: crypto.randomUUID(), body, mine: true, pending: true };
      addOptimisticMessage(message);
      setMessages((current) => [...current, { ...message, pending: false }]);
    });
  }

  return <div className="site-container py-6 sm:py-8"><div className="surface grid min-h-[680px] overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]"><aside className={`${activeId ? "hidden lg:block" : "block"} border-r border-border`}><div className="border-b border-border p-4"><h1 className="text-xl font-extrabold text-text">Messages</h1><label className="relative mt-3 block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><input className="field pl-10" placeholder="Search conversations" /></label></div><div>{conversations.map((conversation) => <Link key={conversation.id} href={`/messages/${conversation.id}`} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] gap-3 border-b border-border p-4 hover:bg-panel-raised ${active.id === conversation.id ? "bg-panel-strong" : ""}`}><UserAvatar seed={conversation.seed} /><span className="min-w-0"><strong className="block text-sm text-text">{conversation.username}</strong><span className="mt-1 block truncate text-xs text-text-muted">{conversation.preview}</span></span><span className="text-right text-[11px] text-text-muted">{conversation.time}{conversation.unread > 0 && <strong className="mt-2 grid size-5 place-items-center rounded-full bg-focus text-[10px] text-white">{conversation.unread}</strong>}</span></Link>)}</div></aside><section className={`${!activeId ? "hidden lg:flex" : "flex"} min-w-0 flex-col`}><header className="flex min-h-[76px] items-center gap-3 border-b border-border px-4 sm:px-5"><Link href="/messages" className="button-secondary px-3 lg:hidden">Back</Link><UserAvatar seed={active.seed} /><div><h2 className="font-extrabold text-text">{active.username}</h2><p className="text-xs text-trust">Active recently</p></div><div className="ml-auto flex gap-1"><button className="icon-link" aria-label="Archive conversation"><Archive className="size-4" /></button><button className="icon-link" aria-label="Block member"><ShieldOff className="size-4" /></button><button className="icon-link" aria-label="Report conversation"><Flag className="size-4" /></button></div></header><div className="flex-1 space-y-4 overflow-y-auto bg-page p-4 sm:p-6">{optimisticMessages.map((message) => <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-lg border px-4 py-3 text-sm leading-6 sm:max-w-[68%] ${message.mine ? "border-category/25 bg-category/10 text-text" : "border-border bg-panel text-text-secondary"} ${message.pending ? "opacity-60" : ""}`}><p>{message.body}</p><div className="mt-1 flex justify-end gap-2 text-[10px] text-text-muted"><button aria-label="Reply to message"><Reply className="size-3" /></button><span>{message.pending ? "Sending…" : "11:32 AM"}</span></div></div></div>)}</div><form action={sendMessage} className="border-t border-border bg-panel p-3 sm:p-4"><div className="flex items-end gap-2"><button type="button" className="icon-link shrink-0" aria-label="Attach image"><ImagePlus className="size-5" /></button><label className="flex-1"><span className="sr-only">Message</span><textarea name="message" rows={2} maxLength={10000} className="field resize-none" placeholder="Write a message" /></label><button className="button-primary size-11 shrink-0 px-0" aria-label="Send message" disabled={isPending}><Send className="size-4" /></button></div><p className="mt-2 flex items-center gap-1.5 text-[10px] text-text-muted"><Paperclip className="size-3" /> Images only · 10 MB maximum</p></form></section></div></div>;
}
