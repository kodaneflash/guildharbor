import { communityNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const notice = await communityNotice();
  return <AppShell>{notice ?? children}</AppShell>;
}
