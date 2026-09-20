import { MessagesWorkspace } from "@/components/messages-workspace";
export default async function ConversationPage({ params, searchParams }: { params: Promise<{ conversationId: string }>; searchParams: Promise<{ before?: string; q?: string; page?: string }> }) { return <MessagesWorkspace activeId={(await params).conversationId} search={await searchParams} />; }
