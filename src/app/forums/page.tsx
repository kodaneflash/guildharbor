import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategorySection } from "@/components/category-section";
import { demoCategories } from "@/data/demo";

export const metadata: Metadata = { title: "Forums" };

export default function ForumsPage() {
  return (
    <div className="site-container space-y-7 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "GuildHarbor", href: "/" }, { label: "Forums" }]} />
      <div>
        <h1 className="text-2xl font-extrabold text-text sm:text-3xl">Browse forums</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Find conversations, peer support, original digital work, domains, and professional services.</p>
      </div>
      {demoCategories.map((category) => <CategorySection key={category.slug} category={category} />)}
    </div>
  );
}
