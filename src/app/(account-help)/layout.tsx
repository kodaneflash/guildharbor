import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/session";

export default async function AccountHelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getSession())) redirect("/sign-in?returnTo=%2Fsupport");

  return <AppShell>{children}</AppShell>;
}
