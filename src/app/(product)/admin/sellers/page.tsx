import { desc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { sellerProfiles } from "@/db/schema";
import { CommerceModerationForm } from "@/components/commerce-admin-forms";
export default async function SellerModerationPage() { await requirePermission("admin.manage"); const rows = await createReadDatabase().select().from(sellerProfiles).orderBy(desc(sellerProfiles.createdAt)).limit(100); return <div className="site-container max-w-4xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Seller moderation</h1>{!rows.length && <p>No seller profiles.</p>}{rows.map(seller => <section className="surface space-y-3 p-5" key={seller.userId}><h2 className="text-heading-lg font-bold">{seller.name}</h2><p>{seller.status}</p><p>{seller.description}</p><CommerceModerationForm id={seller.userId} kind="seller" inactive={seller.status !== "active"} /></section>)}</div>; }
