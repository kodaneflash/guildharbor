import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AnnouncementCard } from "./announcement-card";

afterEach(cleanup);
const announcement = {
  id: "dddc57c2-93f5-4e85-a603-5940c8c763e3", title: "Community update", authorId: "admin",
  pinned: true, important: true, publishedAt: new Date("2026-09-30T02:00:00Z"), updatedAt: new Date(), removedAt: null,
  content: { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Please read this update.", marks: [{ type: "bold" as const }] },
    { type: "text", text: "Unsafe link", marks: [{ type: "link" as const, attrs: { href: "javascript:alert(1)" } }] },
  ] }] },
};
it("shows team identity, badges, publication date, and safe formatted content", () => {
  render(<AnnouncementCard announcement={announcement} />);
  expect(screen.getByText("Outlaw Team")).toBeVisible();
  expect(screen.getByText("Pinned")).toBeVisible();
  expect(screen.getByText("Important")).toBeVisible();
  expect(screen.getByText("Sep 29, 2026")).toHaveAttribute("dateTime", "2026-09-30T02:00:00.000Z");
  expect(screen.getByRole("link", { name: "Community update" })).toHaveAttribute("href", `/announcements/${announcement.id}`);
  expect(screen.getByText("Please read this update.").tagName).toBe("STRONG");
  expect(screen.queryByRole("link", { name: "Unsafe link" })).toBeNull();
});
it("omits badges for ordinary posts and the self-link on the full post", () => {
  render(<AnnouncementCard announcement={{ ...announcement, pinned: false, important: false }} linked={false} />);
  expect(screen.queryByText("Pinned")).toBeNull();
  expect(screen.queryByText("Important")).toBeNull();
  expect(screen.queryByRole("link", { name: announcement.title })).toBeNull();
  expect(screen.getByRole("heading", { name: announcement.title })).toBeVisible();
});

it("uses a nested heading on home without changing the title link", () => {
  render(<AnnouncementCard announcement={announcement} headingLevel={3} />);
  expect(screen.getByRole("heading", { level: 3, name: announcement.title })).toBeVisible();
});
