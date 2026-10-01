import { Suspense } from "react";

import { ProductNavigation } from "@/components/product-navigation";

import { Header } from "@/components/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="product-shell min-h-screen lg:pl-52">
      <Suspense
        fallback={<div className="h-[76px]" />}
      >
        <Header />
      </Suspense>
      <ProductNavigation />
      <main id="main-content" className="min-h-screen pt-[76px]">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="site-container flex flex-col gap-3 py-8 text-body-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Outlaw.</p>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
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
