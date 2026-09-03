import { MessagesWorkspace } from "@/components/messages-workspace";
export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) { const { conversationId } = await params; return <MessagesWorkspace activeId={conversationId} />; }
