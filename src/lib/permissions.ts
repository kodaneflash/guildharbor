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
  status: "pending_email" | "pending_username" | "active" | "restricted" | "suspended" | "banned" | "deleted";
  permissions: ReadonlySet<Permission>;
};

const readOnlyStatuses = new Set<Actor["status"]>(["pending_email", "pending_username", "restricted"]);

export function can(actor: Actor | null, permission: Permission) {
  if (permission === "forum.read") return actor?.status !== "banned" && actor?.status !== "deleted";
  if (!actor || actor.status !== "active" || readOnlyStatuses.has(actor.status)) return false;
  return actor.permissions.has(permission) || actor.permissions.has("admin.manage");
}

export function assertCan(actor: Actor | null, permission: Permission) {
  if (!can(actor, permission)) throw new Error("FORBIDDEN");
}
