import { ForumRow } from "@/components/forum-row";
import type { ForumCategory } from "@/lib/domain-types";

export function CategorySection({ category }: { category: ForumCategory }) {
  return (
    <section aria-labelledby={`category-${category.slug}`} className="space-y-2">
      <div className="section-heading">
        <div>
          <h2 id={`category-${category.slug}`} className="text-sm font-extrabold uppercase tracking-[0.08em] text-text">{category.name}</h2>
          <p className="mt-1 text-xs text-text-muted">{category.description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {category.forums.map((forum) => <ForumRow key={forum.slug} forum={forum} />)}
      </div>
    </section>
  );
}
