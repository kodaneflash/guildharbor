import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { groups } from "@/db/schema";
import { CommunityAdminForm } from "@/components/community-admin-form";
export default async function GroupsPage() { await requirePermission("admin.manage"); const rows = await createReadDatabase().select().from(groups); return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Community groups</h1><p>Group membership may grant access through configured private-forum rules.</p><details><summary>Create group</summary><CommunityAdminForm kind="group" /></details>{rows.map(item => <details key={item.id}><summary>{item.name}</summary><CommunityAdminForm kind="group" item={item} /></details>)}</div>; }
