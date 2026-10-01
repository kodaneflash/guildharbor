import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { DepositForm } from "./deposit-form";
import { CheckoutConfirmation } from "./checkout-payment";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("keeps the original asset, amount and identity when a deposit response is interrupted", async () => {
  const user = userEvent.setup();
  const fetch = vi.fn().mockRejectedValue(new Error("Response lost"));
  vi.stubGlobal("fetch", fetch);
  render(<DepositForm assets={[{ ticker: "usdterc20", asset: "USDT", network: "eth" }, { ticker: "btc", asset: "BTC", network: "btc" }]} />);
  expect(screen.getAllByRole("option")).toHaveLength(2);
  await user.selectOptions(screen.getByRole("combobox", { name: "Cryptocurrency and network" }), "btc");
  await user.type(screen.getByRole("textbox", { name: "Funding amount (USD reference)" }), "20.00");
  await user.click(screen.getByRole("button", { name: "Review deposit instructions" }));
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Review deposit instructions" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ priceUsd: "20.00", currency: "btc" });
  await user.selectOptions(screen.getByRole("combobox"), "usdterc20");
  await user.click(screen.getByRole("button", { name: "Review deposit instructions" }));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("alert")).toHaveTextContent("Recover your previous request");
});

it("requires explicit exact-charge consent and retries the same interrupted purchase", async () => {
  const user = userEvent.setup();
  const orderId = "00000000-0000-4000-8000-000000000001";
  const fetch = vi.fn().mockRejectedValueOnce(new Error("Response lost")).mockResolvedValueOnce(Response.json({ orderIds: [orderId] }));
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutConfirmation id="00000000-0000-4000-8000-000000000002" total="19.9" expiresAt="2099-01-01T00:00:00Z" completed={false} orderIds={[]} />);
  expect(screen.getByRole("button", { name: "Pay 19.9 USDT from balance" })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: /I confirm the 19.9 USDT charge/ }));
  await user.click(screen.getByRole("button", { name: "Pay 19.9 USDT from balance" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("retry this same confirmation");
  await user.click(screen.getByRole("button", { name: "Pay 19.9 USDT from balance" }));
  expect(await screen.findByRole("heading", { name: "Purchase committed" })).toBeVisible();
  expect(fetch.mock.calls[1]).toEqual(fetch.mock.calls[0]);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ confirmed: true, total: "19.9" });
  expect(screen.getByRole("link", { name: /Open protected order/ })).toHaveAttribute("href", `/account/orders/${orderId}`);
});
