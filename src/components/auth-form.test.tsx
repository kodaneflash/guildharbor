import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignInForm, SignUpForm } from "@/components/auth-form";

describe("social authentication controls", () => {
  it("shows configured Google and Apple signup options", () => {
    render(
      <SignUpForm
        isAppleConfigured
        isConfigured
        isGoogleConfigured
      />,
    );

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Continue with Apple" }),
    ).toBeEnabled();
  });

  it("keeps unconfigured providers visible but unavailable", () => {
    render(
      <SignInForm
        isAppleConfigured={false}
        isConfigured
        isGoogleConfigured={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Sign in with Apple" }),
    ).toBeDisabled();
  });
});
