// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { estimateUsdPurchase, usdAmountFromCents } from "./purchase-estimate";

const input = { priceCents: 2000n, verifiedSettlementTicker: "usdterc20", apiKey: "server-only-test-key" };
const response = (amount: string, from = "20", ticker = "usdterc20") => new Response(`{"currency_from":"usd","amount_from":${from},"currency_to":"${ticker}","estimated_amount":${amount}}`);
afterEach(() => { vi.unstubAllGlobals(); });

it.each(["19.95", "20.202021"])("uses the provider's %s USDT estimate for $20, not a dollar peg", async amount => {
  const request = vi.fn().mockResolvedValue(response(amount));
  vi.stubGlobal("fetch", request);
  expect(await estimateUsdPurchase(input)).toMatchObject({ priceAmount: "20.00", estimatedAmount: amount, executable: false, excludesFees: true });
  expect(request).toHaveBeenCalledWith("https://api.nowpayments.io/v1/estimate?amount=20.00&currency_from=usd&currency_to=usdterc20", expect.objectContaining({ cache: "no-store", redirect: "error", headers: expect.objectContaining({ "x-api-key": input.apiKey }) }));
});
it("preserves monetary digits beyond Number precision", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("9007199254.740993")));
  expect((await estimateUsdPurchase(input)).estimatedAmount).toBe("9007199254.740993");
  expect(usdAmountFromCents(9007199254740993n)).toBe("90071992547409.93");
});
it.each(["0", "-1", "20.1234567"])("rejects unusable estimate %s without rounding", async amount => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(amount)));
  await expect(estimateUsdPurchase(input)).rejects.toThrow("invalid_evidence");
});
it("rejects mismatched price or asset evidence", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response("20", "20.001")).mockResolvedValueOnce(response("20", "20", "other")));
  await expect(estimateUsdPurchase(input)).rejects.toThrow("invalid_evidence");
  await expect(estimateUsdPurchase(input)).rejects.toThrow("invalid_evidence");
});
it("accepts harmless trailing zeroes in the echoed USD amount", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("20.1", "20.0000")));
  expect((await estimateUsdPurchase(input)).estimatedAmount).toBe("20.1");
});
it("does not substitute parity or retry when the provider is unavailable", async () => {
  const request = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", request);
  await expect(estimateUsdPurchase(input)).rejects.toThrow("transport");
  expect(request).toHaveBeenCalledOnce();
});
it("rejects invalid requests before contacting the provider", async () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  await expect(estimateUsdPurchase({ ...input, priceCents: 0n })).rejects.toThrow("Invalid USD");
  await expect(estimateUsdPurchase({ ...input, verifiedSettlementTicker: "../../other" })).rejects.toThrow();
  await expect(estimateUsdPurchase({ ...input, verifiedSettlementTicker: "usdcbase" })).rejects.toThrow();
  await expect(estimateUsdPurchase({ ...input, verifiedSettlementTicker: "usdttrc20" })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
