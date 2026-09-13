import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { eligibleMembershipStatuses, isApprovedMember, type MembershipUser } from "@/lib/membership";
import { reservedUsernames } from "@/lib/validation";

export function communityAccessMode() {
  return env.COMMUNITY_ACCESS_MODE;
}
export function hasCommunityAccess(user: MembershipUser | null) {
  return isApprovedMember(user, communityAccessMode());
}
// Keep directory/profile visibility aligned with the same membership policy.
export function communityMemberFilter() {
  return and(
    inArray(users.membershipStatus, eligibleMembershipStatuses(communityAccessMode())),
    eq(users.accountStatus, "active"),
    eq(users.emailVerified, true),
    sql`${users.username} ~ '^[a-zA-Z0-9_.]{3,30}$'`,
    sql`lower(${users.username}) not in (${sql.join([...reservedUsernames].map(name => sql`${name}`), sql`, `)})`,
  );
}
