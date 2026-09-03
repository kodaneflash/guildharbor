import { demoThreads, findForum } from "@/data/demo";

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
  const { feed } = await params;
  if (!feed.endsWith(".xml")) return new Response("Not found", { status: 404 });
  const forumSlug = feed.slice(0, -4);
  const forum = findForum(forumSlug);
  if (!forum) return new Response("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const items = demoThreads
    .filter((thread) => thread.forumSlug === forumSlug)
    .map(
      (thread) =>
        `<item><title>${escapeXml(thread.title)}</title><link>${origin}/threads/${thread.id}/${thread.slug}</link><guid>${origin}/threads/${thread.id}/${thread.slug}</guid><description>Started by ${escapeXml(thread.creator)} with ${thread.replies} replies.</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(forum.name)} · GuildHarbor</title><link>${origin}/forums/${forumSlug}</link><description>${escapeXml(forum.description)}</description>${items}</channel></rss>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
