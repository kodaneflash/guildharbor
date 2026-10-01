import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AnnouncementAdminForm, AnnouncementRemovalForm } from "./announcement-admin-form";

const actions = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }));
vi.mock("@/app/(product)/admin/announcements/actions", () => ({ saveAnnouncementAction: actions.save, removeAnnouncementAction: actions.remove }));
vi.mock("@/components/rich-text-editor", () => ({ RichTextEditor: () => <input type="hidden" name="content" value='{"type":"doc","content":[]}' readOnly /> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("retains title and flags after a validation error and keeps the submission ID stable", async () => {
  const user = userEvent.setup();
  actions.save.mockResolvedValue({ error: "Enter announcement content.", message: "" });
  render(<AnnouncementAdminForm id="dddc57c2-93f5-4e85-a603-5940c8c763e3" />);
  await user.type(screen.getByRole("textbox", { name: "Title" }), "Important update");
  await user.click(screen.getByRole("checkbox", { name: "Pinned" }));
  await user.click(screen.getByRole("button", { name: "Publish announcement" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Enter announcement content.");
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Important update");
  expect(screen.getByRole("checkbox", { name: "Pinned" })).toBeChecked();
  expect(actions.save.mock.calls[0][2].get("id")).toBe("dddc57c2-93f5-4e85-a603-5940c8c763e3");
  await user.click(screen.getByRole("button", { name: "Publish announcement" }));
  await waitFor(() => expect(actions.save).toHaveBeenCalledTimes(2));
  expect(actions.save.mock.calls[1][2].get("id")).toBe(actions.save.mock.calls[0][2].get("id"));
});

it("shows publication success and starts the next post with a fresh ID", async () => {
  const user = userEvent.setup();
  actions.save.mockResolvedValue({ error: "", message: "Announcement published.", published: true });
  render(<AnnouncementAdminForm id="dddc57c2-93f5-4e85-a603-5940c8c763e3" />);
  await user.type(screen.getByRole("textbox", { name: "Title" }), "First post");
  await user.click(screen.getByRole("button", { name: "Publish announcement" }));
  expect(await screen.findByRole("link", { name: "View announcement" })).toHaveAttribute("href", "/announcements/dddc57c2-93f5-4e85-a603-5940c8c763e3");
  await user.click(screen.getByRole("button", { name: "Publish another announcement" }));
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("");
  await user.type(screen.getByRole("textbox", { name: "Title" }), "Second post");
  await user.click(screen.getByRole("button", { name: "Publish announcement" }));
  await waitFor(() => expect(actions.save).toHaveBeenCalledTimes(2));
  expect(actions.save.mock.calls[1][2].get("id")).not.toBe(actions.save.mock.calls[0][2].get("id"));
});

it("requires confirmation before submitting removal", async () => {
  const user = userEvent.setup();
  actions.remove.mockResolvedValue({ error: "", message: "Announcement removed." });
  render(<AnnouncementRemovalForm id="dddc57c2-93f5-4e85-a603-5940c8c763e3" />);
  await user.click(screen.getByRole("button", { name: "Remove announcement" }));
  expect(actions.remove).not.toHaveBeenCalled();
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Remove announcement" }));
  await waitFor(() => expect(actions.remove).toHaveBeenCalledTimes(1));
  expect(actions.remove.mock.calls[0][1].get("confirm")).toBe("on");
});
