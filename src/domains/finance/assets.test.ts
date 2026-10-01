// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { approvedDepositAssets } from "./assets";
import { financialPolicy } from "./policy";
afterEach(() => vi.unstubAllEnvs());

it("does not expose payment options without account approval", () => {
  vi.stubEnv("NOWPAYMENTS_APPROVED_ASSETS", "");
  expect(approvedDepositAssets()).toEqual([]);
});
it("rejects a wrong settlement contract or more than the small approved allowlist", () => {
  vi.stubEnv("NOWPAYMENTS_SETTLEMENT_TICKER", "usdterc20");
  const asset = { ticker: "usdterc20", asset: "USDT", network: "eth", decimals: 6, tokenContract: financialPolicy.tokenContract,
    memoRequired: false, verificationReference: "isolated-approval-evidence" };
  const extra = { ...asset, ticker: "fixturebtc", asset: "BTC", network: "btc", decimals: 8, tokenContract: null };
  vi.stubEnv("NOWPAYMENTS_APPROVED_ASSETS", JSON.stringify([asset, extra]));
  expect(approvedDepositAssets()).toHaveLength(2);
  vi.stubEnv("NOWPAYMENTS_APPROVED_ASSETS", JSON.stringify([asset]));
  expect(approvedDepositAssets()).toEqual([asset]);
  vi.stubEnv("NOWPAYMENTS_APPROVED_ASSETS", JSON.stringify([{ ...asset, tokenContract: "bridged-token" }, extra]));
  expect(() => approvedDepositAssets()).toThrow("USDT/Ethereum");
  vi.stubEnv("NOWPAYMENTS_APPROVED_ASSETS", JSON.stringify([{ ...asset, network: "base" }, extra]));
  expect(() => approvedDepositAssets()).toThrow("USDT/Ethereum");
  vi.stubEnv("NOWPAYMENTS_APPROVED_ASSETS", JSON.stringify([{ ...asset, ticker: "usdttrc20" }, extra]));
  expect(() => approvedDepositAssets()).toThrow("USDT/Ethereum");
  vi.stubEnv("NOWPAYMENTS_APPROVED_ASSETS", JSON.stringify([asset, extra, { ...extra, ticker: "third" }]));
  expect(() => approvedDepositAssets()).toThrow("approval configuration");
});
