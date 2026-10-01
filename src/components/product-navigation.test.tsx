import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductNavigation } from "./product-navigation";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
afterEach(cleanup);

describe("product navigation", () => {
  it("uses the existing routes and the requested destinations on each surface", () => {
    render(<ProductNavigation />);
    const sidebar = within(screen.getByRole("navigation", { name: "Sidebar navigation" }));
    const bottom = within(screen.getByRole("navigation", { name: "Bottom navigation" }));
    expect(sidebar.getAllByRole("link").map(link => link.textContent)).toEqual(["Home", "Market", "Orders", "Wallet", "Referrals"]);
    expect(bottom.getAllByRole("link").map(link => link.textContent)).toEqual(["Home", "Market", "Orders", "Wallet", "Forum"]);
    for (const nav of [sidebar, bottom]) {
      expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
      expect(nav.getByRole("link", { name: "Market" })).toHaveAttribute("href", "/marketplace");
      expect(nav.getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/account/orders");
      expect(nav.getByRole("link", { name: "Wallet" })).toHaveAttribute("href", "/account/wallet");
    }
    expect(sidebar.getByRole("link", { name: "Referrals" })).toHaveAttribute("href", "/affiliate");
    expect(bottom.getByRole("link", { name: "Forum" })).toHaveAttribute("href", "/forums");
  });

  it.each([
    ["/", "Home", "Home"],
    ["/marketplace/categories/design", "Market", "Market"],
    ["/account/orders/order-id", "Orders", "Orders"],
    ["/account/wallet/deposits/request-id", "Wallet", "Wallet"],
    ["/affiliate", "Referrals", null],
    ["/threads/12/discussion", null, "Forum"],
    ["/marketplace-other", null, null],
  ])("highlights only the matching destination for %s", (pathname, desktopLabel, mobileLabel) => {
    route.pathname = pathname;
    render(<ProductNavigation />);
    for (const [name, label] of [["Sidebar navigation", desktopLabel], ["Bottom navigation", mobileLabel]]) {
      const links = within(screen.getByRole("navigation", { name: name ?? "" })).getAllByRole("link");
      expect(links.filter(link => link.getAttribute("aria-current") === "page").map(link => link.textContent)).toEqual(label ? [label] : []);
    }
  });
});
