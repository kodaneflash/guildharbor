import { CategorySection } from "@/components/category-section";
import { communityNotice } from "@/components/access-notice";
import { forumCategories } from "@/db/queries/community";
export default async function ForumsPage() {
  const notice = await communityNotice();
  if (notice) return notice;
  const categories = await forumCategories();
  return (
    <div className="site-container space-y-7 py-8">
      <h1 className="text-3xl font-extrabold">Browse forums</h1>
      {categories.map((category) => (
        <CategorySection key={category.slug} category={category} />
      ))}
      {!categories.length && (
        <p className="surface p-8 text-text-muted">No forums available yet.</p>
      )}
    </div>
  );
}
