import { describe, expect, it } from "vitest";

import { localRedirectSchema, usernameSchema } from "@/lib/validation";

describe("input validation", () => {
  it("normalizes usernames", () => expect(usernameSchema.parse("Aster.Name")).toBe("aster.name"));
  it("rejects protocol-relative redirects", () => expect(localRedirectSchema.safeParse("//attacker.example").success).toBe(false));
});
