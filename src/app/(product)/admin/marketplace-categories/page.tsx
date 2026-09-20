import { asc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { marketplaceCategories } from "@/db/schema";
import { CategoryForm } from "@/components/commerce-admin-forms";
export default async function CategoryAdministrationPage() { await requirePermission("admin.manage"); const categories = await createReadDatabase().select().from(marketplaceCategories).orderBy(asc(marketplaceCategories.name)); return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Marketplace categories</h1><p>Categories are optional and separate from forum categories. Archiving detaches listings; it does not delete them.</p><h2 className="text-heading-lg font-bold">Create category</h2><CategoryForm categories={categories} />{categories.map(category => <details key={category.id}><summary className="cursor-pointer">{category.name}{category.archivedAt ? " (archived)" : ""}</summary><CategoryForm category={category} categories={categories} /></details>)}</div>; }
