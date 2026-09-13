import { expect, test } from "@playwright/test";

const privateMessage =
  "Sign in to view community content, or create an account.";
test("guest sees the membership notice and registration/login routes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(privateMessage)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create an account" }),
  ).toHaveAttribute("href", "/sign-up");
  await expect(
    page.getByRole("main").getByRole("link", { name: "Log in", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  await expect(
    page.getByRole("link", { name: "Market", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Aster", { exact: true })).toHaveCount(0);
});
test("all community pages gate guests before loading content", async ({
  page,
}) => {
  for (const path of [
    "/forums",
    "/forums/general",
    "/threads/1/known-title",
    "/search?q=secret",
    "/members",
    "/members/some-member",
    "/members/some-member/posts",
    "/notifications",
    "/messages",
    "/settings/profile",
    "/settings/security",
    "/threads/new",
    "/admin/registrations",
    "/admin/forums",
    "/moderation/reports",
  ]) {
    await page.goto(path);
    await expect(page.getByText(privateMessage)).toBeVisible();
    await expect(page.locator("title")).not.toContainText("known-title");
    await expect(page.locator("title")).not.toContainText("some-member");
  }
});
test("feed, files, uploads and thread-view endpoints reject unauthenticated requests", async ({
  request,
}) => {
  for (const path of [
    "/feeds/forums/general.xml",
    "/api/files/00000000-0000-4000-8000-000000000000",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  for (const path of [
    "/api/uploads/sign",
    "/api/uploads/complete",
    "/api/thread-views",
  ]) {
    const response = await request.post(path, { data: {} });
    expect(response.status()).toBe(401);
  }
});
test("RSC payload and HTML contain only the guest gate", async ({
  request,
}) => {
  const headerVariants: Record<string, string>[] = [{}, { RSC: "1" }];
  for (const headers of headerVariants) {
    const response = await request.get("/threads/1/private-title", { headers });
    const body = await response.text();
    expect(body).toContain(privateMessage);
    expect(body).not.toContain("Design system audit for growing product teams");
    expect(body).not.toContain("Independent product designer");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
test("Members navigates to the directory and the narrow layout does not overflow", async ({
  page,
}) => {
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
  if (mobile) {
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
  }
  await page.getByRole("navigation", { name: mobile ? "Mobile primary" : "Primary", exact: true })
    .getByRole("link", { name: "Members", exact: true }).click();
  await expect(page).toHaveURL(/\/members$/);
  await expect(page.getByText(privateMessage)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("removed marketplace and demo avatar endpoints no longer exist", async ({
  request,
}) => {
  expect((await request.get("/marketplace")).status()).toBe(404);
  expect((await request.get("/api/demo-avatars/test.webp")).status()).toBe(404);
});
