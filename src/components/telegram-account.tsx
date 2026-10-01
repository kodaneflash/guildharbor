"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Send } from "lucide-react";
import { createTelegramLinkAction, disconnectTelegramAction, saveTelegramPreferencesAction } from "@/app/(product)/account/telegram-actions";

type State = { connected: boolean; preferences: { type: string; label: string; enabled: boolean }[] };

export function TelegramAccount({ initial, available }: { initial: State; available: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState(initial);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!dialog.current?.open || state.connected || !link) return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/telegram/status", { cache: "no-store" });
      if (!response.ok) return;
      const next: State = await response.json();
      if (next.connected) {
        setState(next);
        setLink("");
        setMessage("Telegram connected. Choose the alerts you want to receive.");
        router.refresh();
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [link, state.connected, router]);

  function open() {
    setMessage("");
    dialog.current?.showModal();
    if (!state.connected) startTransition(async () => {
      const result = await createTelegramLinkAction();
      if ("link" in result && result.link) setLink(result.link);
      else setMessage("Unable to create a link. Refresh the page and try again.");
    });
  }

  async function save(form: FormData) {
    startTransition(async () => {
      await saveTelegramPreferencesAction(form);
      const response = await fetch("/api/telegram/status", { cache: "no-store" });
      if (response.ok) setState(await response.json());
      setMessage("Telegram preferences saved.");
    });
  }

  function disconnect() {
    startTransition(async () => {
      await disconnectTelegramAction();
      setState(current => ({ ...current, connected: false }));
      setLink("");
      setMessage("Telegram disconnected. Alerts will stop.");
      dialog.current?.close();
      router.refresh();
    });
  }

  return <>
    <button className="surface flex w-full items-center gap-3 p-5 text-left hover:bg-panel-raised disabled:opacity-50" onClick={open} disabled={!available}>
      <Send aria-hidden="true" className="size-5" />{state.connected ? "Manage Telegram notifications" : "Connect Telegram notifications"}
    </button>
    {!available && <p className="text-body-sm text-text-muted">Telegram notifications are unavailable until the bot is configured.</p>}
    <dialog ref={dialog} aria-labelledby="telegram-title" className="surface m-auto w-[min(92vw,34rem)] rounded-xl border border-border p-6 text-foreground backdrop:bg-black/75" onClose={() => setMessage("")}>
      <div className="flex justify-between gap-4"><Bell aria-hidden="true" className="size-7" /><button className="rounded px-2 focus-visible:outline-2" onClick={() => dialog.current?.close()} aria-label="Close Telegram settings">✕</button></div>
      <h2 id="telegram-title" className="mt-4 text-heading-lg">{state.connected ? "Telegram notification settings" : "Connect Telegram notifications"}</h2>
      {state.connected ? <>
        <p className="mt-2 text-text-muted">Choose which alerts arrive in your private chat.</p>
        <form action={save} className="mt-5 space-y-3">
          {state.preferences.map(preference => <label key={preference.type} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"><span>{preference.label}</span><input className="size-5 accent-sky-500" type="checkbox" name={preference.type} defaultChecked={preference.enabled} /></label>)}
          <button className="button-primary w-full" disabled={pending}>Save preferences</button>
        </form>
        <button className="mt-4 w-full rounded-lg border border-border p-3 focus-visible:outline-2" onClick={disconnect} disabled={pending}>Disconnect Telegram</button>
      </> : <>
        <p className="mt-2 text-text-muted">Open the link in Telegram and press Start. The link expires in 10 minutes and works once.</p>
        <div className="mt-5 flex gap-2"><input aria-label="Telegram activation link" className="min-w-0 flex-1 rounded border border-border bg-transparent p-2" readOnly value={link} /><button className="rounded border border-border px-3 focus-visible:outline-2" disabled={!link} onClick={async () => { await navigator.clipboard.writeText(link); setMessage("Link copied."); }}>Copy</button></div>
        {link && <a className="button-primary mt-4 block w-full text-center" href={link} target="_blank" rel="noopener noreferrer">Open Telegram bot</a>}
      </>}
      <p role="status" className="mt-3 text-body-sm">{pending ? "Saving…" : message}</p>
    </dialog>
  </>;
}
