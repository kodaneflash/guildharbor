import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SignInForm, SignUpForm } from "@/components/auth-form";

afterEach(async () => { await act(async () => { cleanup(); }); });

describe("social authentication controls", () => {
  it("shows the configured Google signup option", () => {
    render(
      <SignUpForm
        isConfigured
        isGoogleConfigured
      />,
    );

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Continue with Apple" }),
    ).not.toBeInTheDocument();
  });

  it("keeps unconfigured providers visible but unavailable", () => {
    render(
      <SignInForm
        isConfigured
        isGoogleConfigured={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Sign in with Apple" }),
    ).not.toBeInTheDocument();
  });
});
