import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./return-path";
describe("local return destinations", () => {
  it.each([undefined, "https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test", "/\nevil.test", "/sign-in", "/api/files/secret", "/one/../sign-up"])("rejects external, malformed and looping destination %s", value => { expect(safeReturnPath(value)).toBe("/"); });
  it("preserves a product path and search without changing origin", () => { expect(safeReturnPath("/marketplace?q=services&sort=newest")).toBe("/marketplace?q=services&sort=newest"); });
});
