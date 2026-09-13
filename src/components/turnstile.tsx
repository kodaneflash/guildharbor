"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback(token: string): void;
      "expired-callback"(): void;
      "error-callback"(): void;
      theme: string;
    },
  ): string;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
export function Turnstile({
  onToken,
  attempt = 0,
}: {
  onToken(token: string): void;
  attempt?: number;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!ready || !element.current || !window.turnstile || !key) return;
    onToken("");
    const id = window.turnstile.render(element.current, {
      sitekey: key,
      action: "registration",
      theme: "dark",
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    return () => window.turnstile?.remove(id);
  }, [ready, key, onToken, attempt]);
  if (!key) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
      />
      <div ref={element} />
    </>
  );
}
