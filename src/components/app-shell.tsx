import { Suspense } from "react";

import { Header } from "@/components/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page-deep">
      <Suspense
        fallback={<div className="h-[76px] bg-page-deep" />}
      >
        <Header />
      </Suspense>
      <main id="main-content" className="min-h-screen bg-page pt-[76px]">
        {children}
      </main>
      <footer className="border-t border-border bg-page-deep">
        <div className="site-container flex flex-col gap-3 py-8 text-body-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 GuildHarbor.</p>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <a href="/rules" className="hover:text-text">
              Rules
            </a>
            <a href="/privacy" className="hover:text-text">
              Privacy
            </a>
            <a href="/terms" className="hover:text-text">Terms</a>
            <a href="/help" className="hover:text-text">Help</a>
            <a href="/support" className="hover:text-text">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
