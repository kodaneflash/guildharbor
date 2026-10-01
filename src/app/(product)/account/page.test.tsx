// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ telegramQueries: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { TELEGRAM_NOTIFICATIONS_ENABLED: false, TELEGRAM_BOT_USERNAME: "useoutlawbot", TELEGRAM_BOT_TOKEN: "configured", TELEGRAM_BRIDGE_SECRET: "configured" } }));
vi.mock("@/lib/session", () => ({ requireMember: async () => ({ user: { id: "member-1", username: null, name: "Member", email: "member@example.test" } }) }));
vi.mock("@/db/resolve-profile", () => ({ resolvePublicProfile: vi.fn() }));
vi.mock("@/domains/notifications/telegram", () => ({
  telegramEvents: [{ type: "message.received", label: "New private message" }],
  telegramState: async () => { state.telegramQueries++; throw new Error("Unmigrated table was queried"); },
}));
vi.mock("@/components/telegram-account", () => ({ TelegramAccount: ({ available }: { available: boolean }) => <span>Telegram available: {String(available)}</span> }));

import AccountPage from "./page";

describe("account before Telegram migration", () => {
  it("renders the account without querying missing Telegram tables", async () => {
    const html = renderToStaticMarkup(await AccountPage());
    expect(html).toContain("Your account");
    expect(html).toContain("Telegram available: false");
    expect(state.telegramQueries).toBe(0);
  });
});
