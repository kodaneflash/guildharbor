import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TelegramAccount } from "./telegram-account";

const actions = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
vi.mock("@/app/(product)/account/telegram-actions", () => ({ saveTelegramPreferencesAction: actions.save, createTelegramLinkAction: vi.fn(), disconnectTelegramAction: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); });

it("shows the default-on Announcements choice and saves an opt-out alongside existing choices", async () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  const initial = { connected: true, preferences: [
    { type: "announcement.published", label: "Announcements", enabled: true },
    { type: "message.received", label: "New private message", enabled: true },
  ] };
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...initial, preferences: initial.preferences.map(item => ({ ...item, enabled: item.type !== "announcement.published" })) }), { status: 200 }));
  actions.save.mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<TelegramAccount initial={initial} available />);
  await user.click(screen.getByRole("button", { name: "Manage Telegram notifications" }));
  expect(screen.getByRole("checkbox", { name: "Announcements" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Announcements" }));
  await user.click(screen.getByRole("button", { name: "Save preferences" }));
  await waitFor(() => expect(actions.save).toHaveBeenCalledTimes(1));
  expect(actions.save.mock.calls[0][0].get("announcement.published")).toBeNull();
  expect(actions.save.mock.calls[0][0].get("message.received")).toBe("on");
  expect(fetcher).toHaveBeenCalledWith("/api/telegram/status", { cache: "no-store" });
  expect(await screen.findByText("Telegram preferences saved.")).toBeVisible();
});
