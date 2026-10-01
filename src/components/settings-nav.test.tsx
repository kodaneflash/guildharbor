import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsNav } from "./settings-nav";

describe("SettingsNav", () => {
  it("marks only the active settings destination as current", () => {
    render(<SettingsNav active="security" />);

    const navigation = screen.getByRole("navigation", { name: "Settings" });
    expect(navigation).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Notifications" })).not.toHaveAttribute("aria-current");
  });
});
