// @vitest-environment node
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { proxy } from "@/proxy";
it("recognizes the configured cookie prefix but delegates authentication to the server", async () => {
  const response = await proxy(new NextRequest("https://localhost/marketplace", { headers: { cookie: "__Secure-guildharbor.session_token=signed-session" } }));
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("location")).toBeNull();
});
it("overwrites spoofed internal return headers", async () => {
  const response = await proxy(new NextRequest("https://localhost/sign-in", { headers: { "x-product-path": "//evil.test" } }));
  expect(response.headers.get("x-middleware-request-x-product-path")).toBe("/");
});
