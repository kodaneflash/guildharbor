import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { WalletOverview } from "./wallet-overview";

it("keeps money movement disabled and makes the approved policy accessible", () => {
  render(<WalletOverview />);
  expect(screen.getByRole("heading", { name: "Wallet" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Top Up/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Withdraw/ })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "#wallet-transactions");
  expect(screen.getAllByText("Not active")).toHaveLength(3);
  expect(screen.getAllByText(/External cash-out is unavailable/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Funded escrow and refunds are unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/Existing USD listing prices have not been converted/)).toBeInTheDocument();
  expect(screen.queryByText("0 USDT")).not.toBeInTheDocument();
});
