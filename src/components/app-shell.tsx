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
        <div className="site-container flex flex-col gap-3 py-8 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 GuildHarbor. Community feedback is not a guarantee of safety.
          </p>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <a href="#" className="hover:text-text">
              Rules
            </a>
            <a href="#" className="hover:text-text">
              Privacy
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
