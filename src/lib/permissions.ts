import { isApprovedMember, type CommunityAccessMode } from "@/lib/membership";
export type Permission =
  | "forum.read"
  | "thread.create"
  | "thread.reply"
  | "thread.edit.own"
  | "thread.moderate"
  | "reputation.give"
  | "vouch.give"
  | "message.send"
  | "report.create"
  | "moderation.review"
  | "admin.manage";

export type Actor = {
  id: string;
  emailVerified: boolean;
  username: string | null;
  membershipStatus: "pending" | "approved" | "rejected";
  status:
    | "pending_email"
    | "pending_username"
    | "active"
    | "restricted"
    | "suspended"
    | "banned"
    | "deleted";
  permissions: ReadonlySet<Permission>;
};

export function can(actor: Actor | null, permission: Permission, mode: CommunityAccessMode = "private") {
  if (
    !actor ||
    !isApprovedMember({ ...actor, accountStatus: actor.status }, mode)
  )
    return false;
  if (permission === "forum.read") return true;
  return (
    actor.permissions.has(permission) || actor.permissions.has("admin.manage")
  );
}

export function assertCan(actor: Actor | null, permission: Permission, mode: CommunityAccessMode = "private") {
  if (!can(actor, permission, mode)) throw new Error("FORBIDDEN");
}
