import { expect, test } from "@playwright/test";

test("public forum content is rendered and navigable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Latest discussions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "GuildHarbor marketplace rules and safety guide" })).toBeVisible();
  await page.goto("/members/Aster");
  await expect(page.getByRole("heading", { name: "Aster", exact: true })).toBeVisible();
});

test("global shell matches the reference desktop width and responsive gutter", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const desktopContainer = await page.locator("main .site-container").boundingBox();
  expect(desktopContainer?.width).toBeCloseTo(960, 0);
  expect(desktopContainer?.x).toBeCloseTo(160, 0);

  await page.setViewportSize({ width: 1000, height: 800 });
  const responsiveContainer = await page.locator("main .site-container").boundingBox();
  expect(responsiveContainer?.width).toBeCloseTo(980, 0);
  expect(responsiveContainer?.x).toBeCloseTo(10, 0);
});

test("320px layouts do not overflow horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ["/", "/threads/10477/accessible-nextjs-audit-and-remediation-service", "/members/Aster", "/messages/demo"]) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
