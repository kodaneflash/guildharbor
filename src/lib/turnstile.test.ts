// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const config = vi.hoisted(() => ({
  NODE_ENV: "production",
  TURNSTILE_SECRET_KEY: "test-secret",
  BETTER_AUTH_URL: "https://community.example.test",
}));
vi.mock("@/lib/env", () => ({ env: config }));
import { verifyTurnstile } from "@/lib/turnstile";
afterEach(() => vi.unstubAllGlobals());
describe("server-side Turnstile verification", () => {
  it("rejects missing tokens before contacting Cloudflare", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(verifyTurnstile(null)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { success: false },
    { success: true, hostname: "wrong.example.test", action: "registration" },
    { success: true, hostname: "community.example.test", action: "wrong" },
  ])(
    "rejects failed, expired/replayed or mismatched claims: %j",
    async (result) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(result)));
      await expect(verifyTurnstile("token")).rejects.toThrow();
    },
  );
  it("accepts only the correct hostname and action", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          success: true,
          hostname: "community.example.test",
          action: "registration",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(verifyTurnstile("token")).resolves.toBeUndefined();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      secret: "test-secret",
      response: "token",
    });
  });
  it("fails closed when production credentials are absent", async () => {
    config.TURNSTILE_SECRET_KEY = "";
    await expect(verifyTurnstile("token")).rejects.toThrow();
    config.TURNSTILE_SECRET_KEY = "test-secret";
  });
});
