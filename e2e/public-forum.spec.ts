import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("guest reaches sign-in with a prominent registration link and safe return destination", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2F$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up?returnTo=%2F");
});
test("all product documents redirect guests before loading content", async ({ request }) => {
  for (const path of ["/", "/forums", "/forums/general", "/threads/1/known-title", "/search?q=secret", "/members", "/members/some-member", "/members/some-member/posts", "/notifications", "/messages", "/settings/profile", "/settings/security", "/threads/new", "/admin/registrations", "/admin/forums", "/moderation/reports", "/marketplace", "/cart", "/checkout", "/sellers/trusted", "/sellers/example/reviews", "/account/wallet", "/seller/advertising", "/deals", "/support", "/privacy"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    const location = new URL(response.headers().location, response.url());
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("returnTo")).toBe(path);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
test("feed, files, uploads and thread-view endpoints reject unauthenticated requests", async ({ request }) => {
  for (const path of ["/feeds/forums/general.xml", "/api/files/00000000-0000-4000-8000-000000000000"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  for (const path of ["/api/uploads/sign", "/api/uploads/complete", "/api/thread-views"]) expect((await request.post(path, { data: {} })).status()).toBe(401);
});
test("HTML, RSC and forged cookie requests reveal no private metadata", async ({ request }) => {
  const variants: Record<string, string>[] = [{}, { RSC: "1" }, { Cookie: "__Secure-guildharbor.session_token=forged" }];
  for (const headers of variants) {
    const response = await request.get("/threads/1/private-title", { headers });
    const body = await response.text();
    expect(body).not.toContain("Design system audit for growing product teams");
    expect(body).not.toContain("Independent product designer");
    expect(body).not.toMatch(/<title>[^<]*private-title/);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
test("authentication pages remain accessible and reflow at 320px", async ({ page }) => {
  for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/two-factor"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
});
test("keyboard skip link reaches the main content", async ({ page, browserName }) => {
  await page.goto("/sign-in");
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
});
