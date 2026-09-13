import { describe, expect, it } from "vitest";

import { can, type Actor } from "@/lib/permissions";

const activeActor: Actor = {
  id: "member",
  emailVerified: true,
  username: "member",
  membershipStatus: "approved",
  status: "active",
  permissions: new Set(["thread.reply"]),
};
describe("permission policy", () => {
  it("allows explicit permissions for active members", () =>
    expect(can(activeActor, "thread.reply")).toBe(true));
  it("blocks restricted members from mutations", () =>
    expect(can({ ...activeActor, status: "restricted" }, "thread.reply")).toBe(
      false,
    ));
  it("blocks banned members from public reads", () =>
    expect(can({ ...activeActor, status: "banned" }, "forum.read")).toBe(
      false,
    ));
});
