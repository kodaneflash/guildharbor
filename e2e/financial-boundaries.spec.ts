import { expect, test } from "@playwright/test";

const id = "00000000-0000-4000-8000-000000000000";

test("financial documents and delivery reject guest and forged-session access", async ({ page, request, baseURL }) => {
  const paths = ["/account/wallet/top-up", `/account/wallet/deposits/${id}`, `/checkout/${id}`, `/account/orders/${id}`, "/seller/orders"];
  for (const path of paths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(new URL(response.headers().location, response.url()).pathname).toBe("/sign-in");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  if (!baseURL) throw new Error("Acceptance origin is required.");
  await page.context().addCookies([{ name: "__Secure-outlaw.session_token", value: "forged", url: baseURL, secure: true }]);
  // Cookie presence passes the proxy, but server authentication still denies
  // access. Next's streamed redirects are checked by their browser outcome.
  for (const path of paths) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Pay .* USDT from balance|Review deposit instructions|Submit fulfillment/ })).toHaveCount(0);
  }
  const variants: Record<string, string>[] = [{}, { Cookie: "__Secure-outlaw.session_token=forged" }];
  for (const headers of variants) {
    const response = await request.get(`/api/orders/${id}/delivery`, { headers });
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("unauthenticated financial mutations cannot create payments, charges or fulfillment", async ({ request }) => {
  for (const path of ["/api/wallet/deposits", "/api/checkout", `/api/checkout/${id}/purchase`, `/api/seller/orders/${id}/fulfillment`]) {
    const response = await request.post(path, { data: {} });
    expect(response.status(), path).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  expect((await request.post("/api/payments/nowpayments/ipn", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/internal/maintenance", { data: {} })).status()).toBe(401);
});
