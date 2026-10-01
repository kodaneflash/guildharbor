import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FamilyWalletDemo } from "./family-wallet-demo";

const { signInEmail, signInSocial } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: signInEmail, social: signInSocial } },
}));

vi.mock("@/components/turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("verified-token")}>Complete security verification</button>
  ),
}));

vi.mock("input-otp", () => ({
  OTPInput: ({ onChange, value, ...props }: { onChange: (value: string) => void; value: string; "aria-label": string }) => (
    <input aria-label={props["aria-label"]} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

class ResizeObserverStub {
  constructor(callback: ResizeObserverCallback) { void callback; }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.ResizeObserver = ResizeObserverStub;
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
  window.scrollTo = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Object.defineProperty(SVGElement.prototype, "getTotalLength", { configurable: true, value: vi.fn(() => 100) });
  Object.defineProperty(SVGElement.prototype, "getPointAtLength", { configurable: true, value: vi.fn(() => ({ x: 0, y: 0 })) });
  signInEmail.mockReset();
  signInSocial.mockReset();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
});

function renderDrawer() {
  return render(<FamilyWalletDemo isConfigured isGoogleConfigured returnTo="/account/orders" />);
}

async function openDrawer() {
  await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
  return screen.getByRole("dialog");
}

describe("Family Wallet sign-in", () => {
  it("keeps passkey, wallet, and inactive social actions inside the drawer without authenticating", async () => {
    renderDrawer();
    let drawer = await openDrawer();
    await userEvent.click(within(drawer).getByRole("button", { name: "Sign in with Discord" }));
    expect(within(drawer).queryByRole("status")).not.toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole("tab", { name: "Passkey" }));
    await userEvent.click(within(drawer).getByRole("button", { name: "Continue" }));
    expect(within(drawer).getAllByRole("heading", { name: "Sign In" }).length).toBeGreaterThan(0);

    cleanup();
    renderDrawer();
    drawer = await openDrawer();
    await userEvent.click(within(drawer).getByRole("button", { name: "Connect Wallet" }));
    drawer = screen.getByRole("dialog");
    await userEvent.click(await within(drawer).findByRole("button", { name: /Metamask/ }));
    expect(within(drawer).getAllByRole("heading", { name: "Sign In" }).length).toBeGreaterThan(0);
    expect(signInEmail).not.toHaveBeenCalled();
    expect(signInSocial).not.toHaveBeenCalled();
  });

  it("keeps phone visible but sends no code", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    renderDrawer();
    const drawer = await openDrawer();
    await userEvent.click(within(drawer).getByRole("tab", { name: "Phone" }));
    await userEvent.type(within(drawer).getByRole("textbox", { name: "Phone" }), "+15551234567");
    await userEvent.click(within(drawer).getByRole("button", { name: "Continue" }));
    expect(within(drawer).getByRole("status")).toHaveTextContent("Phone sign-in is unavailable");
    expect(signInEmail).not.toHaveBeenCalled();
    expect(signInSocial).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in with the existing password API and preserves the return path", async () => {
    signInEmail.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    renderDrawer();
    const drawer = await openDrawer();
    await userEvent.type(within(drawer).getByRole("textbox", { name: "Email" }), "member@example.com");
    await userEvent.click(within(drawer).getByRole("button", { name: "Continue" }));
    await userEvent.type(within(drawer).getByLabelText("Password"), "correct-password");
    await userEvent.click(within(drawer).getByRole("button", { name: "Sign In" }));
    await waitFor(() => expect(signInEmail).toHaveBeenCalledWith({
      email: "member@example.com",
      password: "correct-password",
      callbackURL: "/account/orders",
    }));
    expect(screen.queryByText("Signed in.")).not.toBeInTheDocument();
  });

  it("uses the source OTP view only after a password-authenticated verification error", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: "EMAIL_NOT_VERIFIED" } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock;
    renderDrawer();
    const drawer = await openDrawer();
    await userEvent.type(within(drawer).getByRole("textbox", { name: "Email" }), "member@example.com");
    await userEvent.click(within(drawer).getByRole("button", { name: "Continue" }));
    await userEvent.type(within(drawer).getByLabelText("Password"), "correct-password");
    await userEvent.click(within(drawer).getByRole("button", { name: "Sign In" }));
    await waitFor(() => expect(within(drawer).getAllByRole("heading", { name: "Confirm Email" }).length).toBeGreaterThan(0));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/email-otp/send-verification-otp", expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/sign-in/email-otp", expect.anything());
  });

  it("submits a verification code to the existing verification endpoint", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: "EMAIL_NOT_VERIFIED" } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    globalThis.fetch = fetchMock;
    renderDrawer();
    const drawer = await openDrawer();
    await userEvent.type(within(drawer).getByRole("textbox", { name: "Email" }), "member@example.com");
    await userEvent.click(within(drawer).getByRole("button", { name: "Continue" }));
    await userEvent.type(within(drawer).getByLabelText("Password"), "correct-password");
    await userEvent.click(within(drawer).getByRole("button", { name: "Sign In" }));
    fireEvent.change(await within(drawer).findByRole("textbox", { name: "Verification code" }), { target: { value: "123456" } });
    await userEvent.click(within(drawer).getByRole("button", { name: "Verify Code" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/email-otp/verify-email", expect.objectContaining({
      body: JSON.stringify({ email: "member@example.com", otp: "123456" }),
    })));
    expect(within(drawer).getByRole("status")).toHaveTextContent("Unable to verify that code");
  }, 15000);

  it("requires Turnstile before starting the configured Google flow", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    signInSocial.mockResolvedValue({ data: null, error: { message: "OAuth unavailable" } });
    renderDrawer();
    const drawer = await openDrawer();
    await userEvent.click(within(drawer).getByRole("button", { name: "Sign in with Google" }));
    const continueButton = within(drawer).getByRole("button", { name: "Continue with Google" });
    expect(continueButton).toBeDisabled();
    await userEvent.click(within(drawer).getByRole("button", { name: "Complete security verification" }));
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    await waitFor(() => expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/onboarding/username?returnTo=%2Faccount%2Forders",
      newUserCallbackURL: "/onboarding/username?returnTo=%2Faccount%2Forders",
      errorCallbackURL: "/sign-in?error=oauth",
      fetchOptions: { headers: { "x-turnstile-token": "verified-token" } },
    }));
  });
});
