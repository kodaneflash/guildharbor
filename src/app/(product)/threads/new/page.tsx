import { communityNotice } from "@/components/access-notice";
import { NewThreadForm } from "@/components/new-thread-form";
import { availableForums } from "@/db/queries/community";
export default async function NewThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ forum?: string }>;
}) {
  const notice = await communityNotice();
  if (notice) return notice;
  const forums = (await availableForums("create")).map(({ forum }) => ({
    slug: forum.slug,
    title: forum.title,
  }));
  return (
    <div className="site-container max-w-5xl space-y-6 py-8">
      <h1 className="text-display-sm font-extrabold">Create a thread</h1>
      {forums.length ? (
        <NewThreadForm forums={forums} selected={(await searchParams).forum} />
      ) : (
        <p className="surface p-8 text-text-muted">
          No forums are available for posting.
        </p>
      )}
    </div>
  );
}
