import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuildHarborNavbarClient } from "@/components/guildharbor-navbar-client";

vi.mock("next/navigation", () => ({ usePathname: () => "/marketplace" }));

afterEach(cleanup);

describe("GuildHarborNavbarClient", () => {
  it("uses accessible desktop dropdowns and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<GuildHarborNavbarClient isAuthenticated={false} />);

    const trigger = screen.getByRole("button", { name: "Discover" });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Marketplace/ })).toHaveAttribute("href", "/marketplace");

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("closes the mobile menu when a destination is chosen", async () => {
    const user = userEvent.setup();
    render(<GuildHarborNavbarClient isAuthenticated={false} />);

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    await user.click(menuButton);
    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    await user.click(within(mobileNavigation).getByRole("button", { name: "Community" }));
    await user.click(within(mobileNavigation).getByRole("link", { name: /Forums/ }));

    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
  });

  it("shows server-provided account state without fetching a browser session", async () => {
    const user = userEvent.setup();
    render(
      <GuildHarborNavbarClient
        isAuthenticated
        account={{ admin: true, cartCount: 2, username: "harbor_master" }}
        signOutAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "harbor_master" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Cart, 2 items" })).toHaveAttribute("href", "/cart");

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
  });
});
