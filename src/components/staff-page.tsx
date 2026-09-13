import { desc } from "drizzle-orm";
import { staffNotice } from "@/components/access-notice";
import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import {
  forums,
  groups,
  badges,
  siteSettings,
  reports,
  moderationActions,
} from "@/db/schema";
export async function StaffPage({
  kind,
  title,
  description,
}: {
  kind: "reports" | "forums" | "badges" | "groups" | "settings" | "user";
  title: string;
  description: string;
}) {
  const notice = await staffNotice(
    kind === "reports" || kind === "user"
      ? "moderation.review"
      : "admin.manage",
  );
  if (notice) return notice;
  await requirePermission(
    kind === "reports" || kind === "user"
      ? "moderation.review"
      : "admin.manage",
  );
  const db = createReadDatabase();
  const rows =
    kind === "forums"
      ? await db.select({ text: forums.title }).from(forums).limit(100)
      : kind === "groups"
        ? await db.select({ text: groups.name }).from(groups).limit(100)
        : kind === "badges"
          ? await db.select({ text: badges.name }).from(badges).limit(100)
          : kind === "settings"
            ? await db
                .select({ text: siteSettings.key })
                .from(siteSettings)
                .limit(100)
            : kind === "reports"
              ? await db
                  .select({ text: reports.reason })
                  .from(reports)
                  .orderBy(desc(reports.id))
                  .limit(100)
              : await db
                  .select({ text: moderationActions.action })
                  .from(moderationActions)
                  .orderBy(desc(moderationActions.id))
                  .limit(100);
  return (
    <div className="site-container space-y-6 py-8">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="text-text-muted">{description}</p>
      <section className="surface divide-y divide-border">
        {rows.map((row, index) => (
          <p key={index} className="p-5">
            {row.text}
          </p>
        ))}
        {!rows.length && <p className="p-8 text-text-muted">No records.</p>}
      </section>
    </div>
  );
}
