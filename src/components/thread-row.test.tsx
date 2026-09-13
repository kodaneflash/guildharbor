import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThreadRow } from "@/components/thread-row";
import type { ThreadListItem } from "@/lib/domain-types";
const testThread: ThreadListItem = {
  id: 1,
  slug: "persisted-thread",
  forumSlug: "general",
  title: "Persisted thread",
  type: "discussion",
  creator: "member",
  avatarSeed: "M",
  replies: 2,
  views: 0,
  latestReplyAt: "2026-09-12",
  latestReplier: "member",
  isPinned: true,
};

describe("ThreadRow", () => {
  it("exposes title, creator, reply count, and state labels", () => {
    render(<ThreadRow thread={testThread} />);
    expect(
      screen.getByRole("link", { name: testThread.title }),
    ).toHaveAttribute("href", `/threads/${testThread.id}/${testThread.slug}`);
    expect(
      screen.getByRole("link", { name: testThread.creator }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
    expect(
      screen.getByText(testThread.replies.toLocaleString("en-US")),
    ).toBeInTheDocument();
  });
});
