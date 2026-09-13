import { describe, expect, it } from "vitest";
import { isApprovedMember } from "@/lib/membership";
const user = {
  emailVerified: true,
  username: "member",
  accountStatus: "active",
  membershipStatus: "approved",
};
describe("membership boundary", () => {
  it("denies guests", () => expect(isApprovedMember(null)).toBe(false));
  it("admits only fully onboarded, approved active members", () =>
    expect(isApprovedMember(user)).toBe(true));
  it.each(["pending", "rejected"])(
    "denies %s registrations",
    (membershipStatus) =>
      expect(isApprovedMember({ ...user, membershipStatus })).toBe(false),
  );
  it.each([
    "pending_email",
    "pending_username",
    "restricted",
    "suspended",
    "banned",
    "deleted",
  ])("denies %s accounts even if approved", (accountStatus) =>
    expect(isApprovedMember({ ...user, accountStatus })).toBe(false),
  );
  it("denies approved users without email verification or username", () => {
    expect(isApprovedMember({ ...user, emailVerified: false })).toBe(false);
    expect(isApprovedMember({ ...user, username: null })).toBe(false);
  });
});


describe.each(["public", "private"] as const)("%s membership mode", (mode) => {
  it("denies guests and requires completed onboarding", () => {
    expect(isApprovedMember(null, mode)).toBe(false);
    for (const username of [null, "", "ab", "admin", "invalid name"]) {
      expect(isApprovedMember({ ...user, username }, mode)).toBe(false);
    }
    expect(isApprovedMember({ ...user, emailVerified: false }, mode)).toBe(false);
  });
  it("preserves explicit approval and admits pending users only in public mode", () => {
    expect(isApprovedMember(user, mode)).toBe(true);
    expect(isApprovedMember({ ...user, membershipStatus: "pending" }, mode)).toBe(mode === "public");
  });
  it.each(["restricted", "suspended", "banned", "deleted", "pending_email", "pending_username"])("denies %s accounts", (accountStatus) => {
    for (const membershipStatus of ["pending", "approved"]) {
      expect(isApprovedMember({ ...user, accountStatus, membershipStatus }, mode)).toBe(false);
    }
  });
  it.each(["rejected", "unknown"])("denies %s memberships", (membershipStatus) => {
    expect(isApprovedMember({ ...user, membershipStatus }, mode)).toBe(false);
  });
});
