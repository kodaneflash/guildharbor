import { communityNotice } from "@/components/access-notice";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const notice = await communityNotice();
  return notice ?? children;
}
