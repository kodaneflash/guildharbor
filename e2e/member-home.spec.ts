import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, inArray } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as schema from "../src/db/schema";

// Explicit opt-in: creates short-lived fixture accounts in the configured database.
// Never reads existing sessions or credentials; cleanup targets only fixture IDs.
test("member discovery, cart persistence, seller routing and responsive accessibility", async ({ page }, testInfo) => {
  test.skip(process.env.AUTHENTICATED_E2E !== "1", "Requires explicit authenticated database acceptance opt-in");
  test.setTimeout(180000);
  if (!process.env.DATABASE_URL) throw new Error("Authenticated acceptance requires DATABASE_URL");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const suffix = randomUUID().slice(0, 8);
  const buyer = `e2e_buyer_${suffix}`;
  const seller = `e2e_seller_${suffix}`;
  const listingId = randomUUID();
  const password = randomUUID() + "aA1!";
  const title = `Acceptance design ${suffix}`;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await db.insert(schema.users).values([buyer, seller].map(id => ({ id, name: id, username: id, email: `${id}@example.test`, emailVerified: true, accountStatus: "active" as const, membershipStatus: "approved" })));
    await db.insert(schema.accounts).values({ id: randomUUID(), accountId: buyer, providerId: "credential", userId: buyer, password: await hashPassword(password) });
    await db.insert(schema.sellerProfiles).values({ userId: seller, name: `Acceptance studio ${suffix}`, description: "Temporary browser acceptance fixture, removed after the check.", policyVersion: "test-fixture", policyAcceptedAt: new Date() });
    await db.insert(schema.listings).values({ id: listingId, sellerId: seller, title, slug: `acceptance-${suffix}`, description: "Temporary acceptance listing used to verify responsive catalog and cart behavior.", kind: "service", fulfillmentMode: "manual", deliveryTerms: "Acceptance fixture only.", priceCents: 1234, status: "published" });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(`${buyer}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Discover GuildHarbor" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("link", { name: "Open a store", exact: true })).toHaveAttribute("href", "/seller/onboarding");
    const row = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
    await expect(row).toContainText("$12.34 USD");
    await expect(row.getByRole("link", { name: /^Contact seller/ })).toHaveAttribute("href", `/messages?to=${seller}`);
    await row.getByRole("button", { name: /Add to cart/ }).click();
    await expect(row.getByRole("status")).toHaveText("Saved to your account.");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Discover GuildHarbor" })).toBeVisible();
    if (testInfo.project.name === "desktop") {
      const left = await page.getByRole("complementary", { name: "Marketplace discovery" }).boundingBox();
      const center = await page.getByRole("region", { name: "Latest listings" }).boundingBox();
      const right = await page.getByRole("complementary", { name: "Seller and forum discovery" }).boundingBox();
      expect(left && center && right && left.x < center.x && center.x < right.x).toBe(true);
    }
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(row.getByRole("button", { name: /Add to cart/ })).toBeVisible();
    }
    await testInfo.attach("member-home", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    for (const path of ["/", "/cart", "/checkout", "/seller/onboarding", "/forums", "/messages", "/deals", "/settings/notifications"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.setViewportSize({ width: 320, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations, path).toEqual([]);
    }
    await page.goto("/cart");
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await db.update(schema.listings).set({ available: false }).where(eq(schema.listings.id, listingId));
    await page.goto("/");
    await expect(row).toContainText("Currently unavailable");
    await expect(row.getByRole("button", { name: /Add to cart/ })).toHaveCount(0);
    await db.insert(schema.sellerProfiles).values({ userId: buyer, name: `Buyer store ${suffix}`, description: "Temporary existing-seller acceptance fixture.", policyVersion: "test-fixture", policyAcceptedAt: new Date() });
    await page.reload();
    await expect(page.getByRole("link", { name: "Open a store", exact: true })).toHaveAttribute("href", "/seller");
    await db.update(schema.listings).set({ sellerId: buyer, available: true }).where(eq(schema.listings.id, listingId));
    await page.reload();
    await expect(row.getByRole("link", { name: "Edit your listing" })).toBeVisible();
    await expect(row.getByRole("button", { name: /Add to cart/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await db.delete(schema.cartItems).where(eq(schema.cartItems.listingId, listingId));
    await db.delete(schema.listings).where(eq(schema.listings.id, listingId));
    await db.delete(schema.sellerProfiles).where(inArray(schema.sellerProfiles.userId, [buyer, seller]));
    await db.delete(schema.users).where(inArray(schema.users.id, [buyer, seller]));
    await pool.end();
  }
});
