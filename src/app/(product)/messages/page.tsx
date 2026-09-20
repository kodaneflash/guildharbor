import { MessagesWorkspace } from "@/components/messages-workspace";
export const metadata = { title: "Messages" };
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ to?: string; q?: string; page?: string; archived?: string }> }) { return <MessagesWorkspace search={await searchParams} />; }
