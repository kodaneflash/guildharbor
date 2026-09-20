import { readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";
import { z } from "zod";
import { digest, verifySnapshot } from "./migration-safety";
const path = process.argv[2];
if (!path) throw new Error("Usage: bun scripts/import-legacy.ts /restricted/preserved-snapshot.json");
const snapshot = verifySnapshot(JSON.parse(await readFile(path, "utf8")));
const source = snapshot.tables.marketplace_listings;
if (!source) throw new Error("Snapshot contains no legacy listing table; recover a pre-0002 backup into an isolated database first");
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Database URL required");
const pool = new Pool({ connectionString }); const client = await pool.connect(); let imported = 0; let review = 0;
try {
  await client.query("BEGIN"); await client.query("SELECT pg_advisory_xact_lock(714082918)");
  for (const row of source) {
    const legacyId = z.coerce.number().int().positive().safe().parse(row.thread_id);
    const thread = snapshot.tables.threads?.find(record => Number(record.id) === legacyId);
    const payload = { listing: row, thread, vouchReferences: snapshot.tables.vouches?.filter(record => Number(record.listing_thread_id) === legacyId), posts: snapshot.tables.posts?.filter(record => Number(record.thread_id) === legacyId) };
    const checksum = digest(JSON.stringify(payload));
    const existing = await client.query<{ source_checksum: string; listing_id: string | null }>("SELECT source_checksum, listing_id FROM legacy_listing_imports WHERE legacy_thread_id = $1", [legacyId]);
    if (existing.rows.length) { if (existing.rows[0].source_checksum !== checksum) throw new Error("Legacy source changed for an existing import; manual reconciliation required"); if (existing.rows[0].listing_id) continue; }
    // A historical listing is preserved without automatically granting a seller policy acceptance.
    const sellerId = typeof thread?.creator_id === "string" ? thread.creator_id : null;
    const seller = sellerId ? await client.query("SELECT user_id FROM seller_profiles WHERE user_id = $1 AND status = 'active'", [sellerId]) : { rows: [] };
    const price = String(row.price ?? ""); const validPrice = /^\d{1,8}(?:\.\d{1,2})?$/.test(price);
    const [whole, fraction = ""] = price.split("."); const cents = validPrice ? Number(whole) * 100 + Number(fraction.padEnd(2, "0")) : 0;
    const eligible = seller.rows.length && thread && typeof thread.title === "string" && cents > 0 && cents <= 2147483647 && row.currency === "USD" && typeof row.fulfillment === "string";
    let listingId: string | null = null;
    if (eligible) {
      const description = typeof row.search_text === "string" && row.search_text.trim() ? row.search_text : typeof row.fulfillment === "string" ? row.fulfillment : "";
      const result = await client.query<{ id: string }>("INSERT INTO listings (seller_id,title,slug,description,kind,fulfillment_mode,delivery_terms,price_cents,status,available) VALUES ($1,$2,$3,$4,$5,'manual',$6,$7,'draft',false) RETURNING id", [sellerId, thread.title, `legacy-${legacyId}`, description, thread.type === "service" ? "service" : "digital", row.fulfillment, cents]);
      listingId = result.rows[0].id;
      await client.query("INSERT INTO listing_revisions (listing_id,version,title,description,kind,price_cents,fulfillment_mode,delivery_terms) VALUES ($1,1,$2,$3,$4,$5,'manual',$6)", [listingId, thread.title, description, thread.type === "service" ? "service" : "digital", cents, row.fulfillment]); imported++;
    } else review++;
    await client.query("INSERT INTO legacy_listing_imports (legacy_thread_id,listing_id,source_record,source_checksum,status) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (legacy_thread_id) DO UPDATE SET listing_id = EXCLUDED.listing_id, status = EXCLUDED.status", [legacyId, listingId, JSON.stringify(payload), checksum, listingId ? "draft_imported" : "needs_review"]);
  }
  await client.query("COMMIT"); console.log(JSON.stringify({ importedDrafts: imported, preservedForReview: review, sourceCount: source.length }));
} finally { client.release(true); await pool.end(); }
