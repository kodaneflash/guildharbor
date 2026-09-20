import { Suspense } from "react";

import { Header } from "@/components/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page-deep">
      <Suspense
        fallback={<div className="h-[86px] border-b border-border bg-page" />}
      >
        <Header />
      </Suspense>
      <main id="main-content" className="min-h-[calc(100vh-86px)] bg-page">
        {children}
      </main>
      <footer className="border-t border-border bg-page-deep">
        <div className="site-container flex flex-col gap-3 py-8 text-body-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 GuildHarbor. Community feedback is not a guarantee of safety.
          </p>
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
