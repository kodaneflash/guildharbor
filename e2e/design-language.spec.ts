import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const fontName = /openRunde/i;

test("sign-in uses the shared type and blue action system", async ({ page }) => {
  await page.goto("/sign-in");
  const trigger = page.getByRole("button", { name: "Sign In", exact: true });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveCSS("font-family", fontName);
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Sign In" }).last()).toHaveCSS(
    "font-weight",
    (page.viewportSize()?.width ?? 1280) < 640 ? "600" : "500",
  );
  await expect(dialog.getByRole("button", { name: "Connect Wallet" })).toHaveCSS("background-color", "rgb(78, 175, 255)");
  await expect(dialog.getByRole("textbox", { name: "Email" })).toHaveCSS("font-family", fontName);

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `width ${width}`).toBe(true);
  }
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("other auth forms use the same field and page typography", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", fontName);
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveCSS("background-color", "rgb(22, 22, 22)");
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
