import { usernameSchema } from "@/lib/validation";

export type CommunityAccessMode = "public" | "private";
export type MembershipUser = {
  emailVerified: boolean;
  username: string | null;
  accountStatus: string;
  membershipStatus: string;
};
// Stored approval is always explicit. Public eligibility is never persisted.
export function eligibleMembershipStatuses(mode: CommunityAccessMode) {
  return mode === "public" ? ["approved", "pending"] : ["approved"];
}
export function isApprovedMember(
  user: MembershipUser | null,
  mode: CommunityAccessMode = "private",
): boolean {
  return Boolean(
    user &&
    user.emailVerified &&
    usernameSchema.safeParse(user.username).success &&
    user.accountStatus === "active" &&
    eligibleMembershipStatuses(mode).includes(user.membershipStatus),
  );
}
