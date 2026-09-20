import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { fkGrotesk } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "GuildHarbor — Private Community",
    template: "%s · GuildHarbor",
  },
  description: "A members-only community forum.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fkGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-text focus:px-4 focus:py-2 focus:text-page-deep"
        >
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
