import { communityAccessMode } from "@/lib/community-access";
import { asc, eq } from "drizzle-orm";
import { createReadDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { staffNotice } from "@/components/access-notice";
import { reviewRegistration } from "./actions";
export default async function RegistrationQueue() {
  const notice = await staffNotice("admin.manage");
  if (notice) return notice;
  await requirePermission("admin.manage");
  const registrations = await createReadDatabase()
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.membershipStatus, "pending"))
    .orderBy(asc(users.createdAt))
    .limit(100);
  return (
    <div className="site-container space-y-6 py-8">
      <h1 className="text-3xl font-extrabold">Registration queue</h1>
      <p className="text-sm text-text-muted">
        Oldest applications first, up to 100 at a time. Approval also requires a
        verified email and username before access is granted.
      </p>
      <p className="text-sm text-text-muted">{communityAccessMode() === "public" ? "Public registration is enabled. Eligible pending users already have member access. Approval retains access when switching to private mode; rejection denies access in both modes." : "Private registration is enabled. Pending users require administrator approval."}</p>
      <section className="surface divide-y divide-border">
        {registrations.map((user) => (
          <article
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-4 p-5"
          >
            <div>
              <h2 className="font-bold">
                {user.username ?? "Username not selected"}
              </h2>
              <p className="text-sm text-text-muted">
                {user.email} ·{" "}
                {user.emailVerified ? "Email verified" : "Email unverified"}
              </p>
              <p className="text-xs text-text-muted">
                {user.createdAt.toISOString()}
              </p>
            </div>
            <form action={reviewRegistration} className="flex gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <button
                className="button-primary"
                name="decision"
                value="approved"
              >
                Approve
              </button>
              <button
                className="button-danger"
                name="decision"
                value="rejected"
              >
                Reject
              </button>
            </form>
          </article>
        ))}
        {!registrations.length && (
          <p className="p-8 text-text-muted">
            No registrations awaiting review.
          </p>
        )}
      </section>
    </div>
  );
}
