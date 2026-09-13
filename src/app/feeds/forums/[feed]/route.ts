import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { findForum, communityThreads } from "@/db/queries/community";
function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ feed: string }> },
) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  const { feed } = await params;
  if (!feed.endsWith(".xml"))
    return new Response(null, { status: 404, headers: privateHeaders });
  const forum = await findForum(feed.slice(0, -4));
  if (!forum)
    return new Response(null, { status: 404, headers: privateHeaders });
  const origin = new URL(request.url).origin;
  const items = (await communityThreads({ forumId: forum.id }))
    .map(
      (thread) =>
        `<item><title>${escapeXml(thread.title)}</title><link>${escapeXml(`${origin}/threads/${thread.id}/${thread.slug}`)}</link><guid>${escapeXml(`${origin}/threads/${thread.id}/${thread.slug}`)}</guid></item>`,
    )
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(forum.title)}</title><link>${escapeXml(`${origin}/forums/${forum.slug}`)}</link><description>${escapeXml(forum.description)}</description>${items}</channel></rss>`,
    {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    },
  );
}
