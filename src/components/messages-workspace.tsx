import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { communityNotice } from "@/components/access-notice";
import { requireMember } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { conversationMembers, conversations } from "@/db/schema";
import { listConversationMessages } from "@/db/queries/message-queries";
export async function MessagesWorkspace({ activeId }: { activeId?: string }) {
  const notice = await communityNotice();
  if (notice) return notice;
  const access = await requireMember();
  const database = createReadDatabase();
  const rows = await database
    .select({ id: conversations.id, title: conversations.type })
    .from(conversationMembers)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationMembers.conversationId),
    )
    .where(
      and(
        eq(conversationMembers.userId, access.user.id),
        isNull(conversationMembers.archivedAt),
      ),
    )
    .orderBy(desc(conversations.latestMessageAt))
    .limit(50);
  if (activeId && !z.uuid().safeParse(activeId).success) notFound();
  const messages = activeId
    ? await listConversationMessages(database, access.user.id, activeId)
    : null;
  if (activeId && !messages) notFound();
  return (
    <div className="site-container py-8">
      <div className="surface grid min-h-[500px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-border p-5">
          <h1 className="text-xl font-extrabold">Messages</h1>
          <div className="mt-5 space-y-3">
            {rows.map((row) => (
              <Link
                className="block rounded border border-border p-4"
                href={`/messages/${row.id}`}
                key={row.id}
              >
                {row.title || "Conversation"}
              </Link>
            ))}
            {!rows.length && (
              <p className="text-sm text-text-muted">No conversations yet.</p>
            )}
          </div>
        </aside>
        <section className="space-y-4 p-6">
          {messages ? (
            [...messages].reverse().map((message) => (
              <article
                key={message.id}
                className="rounded border border-border p-4"
              >
                <p className="whitespace-pre-wrap text-sm">
                  {message.plainText}
                </p>
                <time className="mt-2 block text-xs text-text-muted">
                  {message.createdAt.toISOString()}
                </time>
              </article>
            ))
          ) : (
            <p className="text-text-muted">Select a conversation.</p>
          )}
          {messages?.length === 0 && <p>No messages.</p>}
        </section>
      </div>
    </div>
  );
}
