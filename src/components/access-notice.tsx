import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/return-path";
import { communityAccessMode } from "@/lib/community-access";
import Link from "next/link";
import { getAccess } from "@/lib/session";

import { PendingReview } from "@/components/access-notice-client";

export async function communityNotice() {
  const access = await getAccess();
  if (access.allowed) return null;
  const user = access.user;
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(safeReturnPath((await headers()).get("x-product-path")))}`);
  const requiresApproval = communityAccessMode() === "private";
  return (
    <div className="site-container py-12">
      {user.membershipStatus === "rejected" ? (
        <section className="surface mx-auto max-w-xl p-7">
          <h1 className="text-heading-xl font-extrabold">Registration not approved</h1>
          <p className="mt-3 text-text-muted">
            Your registration request was declined.
          </p><Link href="/support" className="button-secondary mt-4">Request account support</Link>
        </section>
      ) : user.accountStatus !== "active" &&
        !["pending_email", "pending_username"].includes(user.accountStatus) ? (
        <section className="surface mx-auto max-w-xl p-7">
          <h1>Community access unavailable</h1>
          <p>Your account does not currently have access.</p><Link href="/support" className="button-secondary mt-4">Request account support</Link>
        </section>
      ) : (
        <div className="space-y-4">
          {requiresApproval && user.emailVerified && user.username ? <PendingReview /> : <section className="surface mx-auto max-w-xl p-7"><h1 className="text-heading-xl font-extrabold">Complete your registration</h1><p>Verify your email and choose a unique username to continue.</p></section>}
          {!user.emailVerified && (
            <p className="text-center">
              <Link
                className="text-category"
                href={`/verify-email?email=${encodeURIComponent(user.email)}`}
              >
                Verify your email
              </Link>
            </p>
          )}
          {!user.username && (
            <p className="text-center">
              <Link className="text-category" href="/onboarding/username">
                Choose your username
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export async function staffNotice(permission: string) {
  const notice = await communityNotice();
  if (notice) return notice;
  const access = await getAccess();
  if (
    access.permissions.includes(permission) ||
    access.permissions.includes("admin.manage")
  )
    return null;
  return (
    <div className="site-container py-12">
      <section className="surface p-7">
        <h1 className="text-heading-xl font-bold">Staff access required</h1>
        <p className="mt-3 text-text-muted">
          You do not have permission to view this page.
        </p>
      </section>
    </div>
  );
}
