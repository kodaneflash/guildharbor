import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { badges } from "@/db/schema";
import { CommunityAdminForm } from "@/components/community-admin-form";
export default async function BadgesPage() { await requirePermission("admin.manage"); const rows = await createReadDatabase().select().from(badges); return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Community awards</h1><p>Community awards are distinct from verified purchases and Trusted Seller qualification. Record the evidence for each award in its audit reason.</p><details><summary>Create community award</summary><CommunityAdminForm kind="badge" /></details>{rows.map(item => <details key={item.id}><summary>{item.name}</summary><CommunityAdminForm kind="badge" item={item} /></details>)}</div>; }
