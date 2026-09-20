// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { describe, expect, it } from "vitest";
import { captureSnapshot, requirePreservation, verifySnapshot } from "../../scripts/migration-safety";

async function legacyDatabase() {
  const pg = new PGlite({ extensions: { citext, pg_trgm } });
  for (const name of ["0000_slow_solo", "0001_aspiring_black_panther"]) await pg.exec(await readFile(`drizzle/${name}.sql`, "utf8"));
  return pg;
}
describe("migration preservation", () => {
  it("allows a fresh database and never seeds a marketplace", async () => {
    const pg = new PGlite({ extensions: { citext, pg_trgm } });
    try {
      expect(() => requirePreservation({ version: 1, tables: {}, sha256: "" }, undefined, true)).not.toThrow();
      const journal: { entries: { tag: string }[] } = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
      for (const { tag: name } of journal.entries) await pg.exec(`BEGIN; ${await readFile(`drizzle/${name}.sql`, "utf8")} COMMIT;`);
      const snapshot = await captureSnapshot(pg);
      expect(snapshot.tables.users).toHaveLength(0);
      expect(snapshot.tables.categories).toHaveLength(0);
      expect(snapshot.tables.marketplace_listings).toBeUndefined();
      for (const table of ["marketplace_categories", "seller_profiles", "listings", "cart_items", "deals", "notification_outbox"]) expect(snapshot.tables[table]).toEqual([]);
    } finally { await pg.close(); }
  }, 30000);
  it("preserves full legacy payloads and original relationships before destructive history", async () => {
    const pg = await legacyDatabase();
    try {
      await pg.exec(`INSERT INTO users (id,name,email,email_verified,username) VALUES ('legacy','Legacy','legacy@example.test',true,'legacy');
        INSERT INTO categories (slug,title) VALUES ('original','Original');
        INSERT INTO forums (category_id,slug,title) SELECT id,'original','Original' FROM categories;
        INSERT INTO threads (forum_id,creator_id,slug,title,type) SELECT id,'legacy','original','Original service','service' FROM forums;
        INSERT INTO marketplace_listings (thread_id,price,currency,category,fulfillment,lawful_attestation) SELECT id,123.45,'USD','Historical category','Manual instructions',true FROM threads;
        UPDATE profiles SET avatar_url = 'https://old.example.test/avatar' WHERE user_id = 'legacy';`);
      const before = await captureSnapshot(pg);
      expect(() => requirePreservation(before, undefined, true)).toThrow("verified preservation");
      expect(() => requirePreservation(before, before, true)).not.toThrow();
      const damaged = structuredClone(before);
      damaged.tables.users[0].name = "Changed";
      expect(() => verifySnapshot(damaged)).toThrow("checksum");
      await pg.exec(`BEGIN; ${await readFile("drizzle/0002_private_forum.sql", "utf8")} COMMIT;`);
      const after = await captureSnapshot(pg);
      expect(after.tables.marketplace_listings).toBeUndefined();
      expect(before.tables.marketplace_listings[0]).toMatchObject({ price: 123.45, category: "Historical category", fulfillment: "Manual instructions" });
      expect(before.tables.threads[0].type).toBe("service");
      expect(before.tables.profiles[0].avatar_url).toBe("https://old.example.test/avatar");
      expect(after.tables.users[0].id).toBe("legacy");
      expect(after.tables.threads[0].type).toBe("discussion");
      expect(() => requirePreservation(after, before, true)).toThrow("changed");
    } finally { await pg.close(); }
  }, 30000);
});
