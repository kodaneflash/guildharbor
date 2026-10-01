// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const context = vi.hoisted(() => ({ authorize: vi.fn(), save: vi.fn(), remove: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ requirePermission: context.authorize }));
vi.mock("next/cache", () => ({ revalidatePath: context.revalidate }));
vi.mock("@/domains/announcements/announcement-service", () => ({ saveAnnouncement: context.save, removeAnnouncement: context.remove }));
import { removeAnnouncementAction, saveAnnouncementAction } from "./actions";
const id = "dddc57c2-93f5-4e85-a603-5940c8c763e3";
const state = { error: "", message: "" };
function form() {
  const result = new FormData();
  result.set("id", id); result.set("title", "Community update");
  result.set("content", JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Please read this update." }] }] }));
  return result;
}
beforeEach(() => { vi.resetAllMocks(); context.authorize.mockResolvedValue({ user: { id: "admin" } }); context.save.mockResolvedValue({ id }); context.remove.mockResolvedValue({ id }); });

it("authorizes before validation and rejects invalid content without publishing", async () => {
  context.authorize.mockRejectedValue(new Error("FORBIDDEN"));
  await expect(saveAnnouncementAction("publish", state, form())).rejects.toThrow("FORBIDDEN");
  await expect(removeAnnouncementAction(state, form())).rejects.toThrow("FORBIDDEN");
  expect(context.save).not.toHaveBeenCalled(); expect(context.remove).not.toHaveBeenCalled();
  context.authorize.mockResolvedValue({ user: { id: "admin" } });
  const invalid = form(); invalid.set("content", "{");
  expect((await saveAnnouncementAction("publish", state, invalid)).error).toBe("Invalid announcement content.");
  expect(context.save).not.toHaveBeenCalled();
});
it("refreshes all affected routes after publication or editing and surfaces unavailable posts", async () => {
  expect(await saveAnnouncementAction("publish", state, form())).toHaveProperty("published", true);
  expect(context.authorize).toHaveBeenCalledWith("admin.manage");
  expect(context.revalidate.mock.calls.map(call => call[0])).toEqual(["/", "/announcements", `/announcements/${id}`, "/admin/announcements"]);
  context.revalidate.mockClear();
  expect(await saveAnnouncementAction("edit", state, form())).toHaveProperty("published", false);
  expect(context.revalidate).toHaveBeenCalledTimes(4);
  context.save.mockResolvedValue({ error: "Announcement is unavailable." }); context.revalidate.mockClear();
  expect((await saveAnnouncementAction("edit", state, form())).error).toBe("Announcement is unavailable.");
  expect(context.revalidate).not.toHaveBeenCalled();
});
it("requires confirmed removal and refreshes the affected routes afterward", async () => {
  const data = form();
  expect((await removeAnnouncementAction(state, data)).error).toContain("Confirm removal");
  expect(context.remove).not.toHaveBeenCalled();
  data.set("confirm", "on");
  expect((await removeAnnouncementAction(state, data)).message).toBe("Announcement removed.");
  expect(context.remove).toHaveBeenCalledWith(id);
  expect(context.revalidate).toHaveBeenCalledTimes(4);
});
