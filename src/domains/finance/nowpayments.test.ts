// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { classifyDeposit, lookupPayment, parseProviderJson, payoutDisposition, readProviderBody, verifyIpn, type PaymentEvidence } from "./nowpayments";
import { assertFinancialExecutionEnabled } from "./gate";
import { encryptEvidence } from "./commands";

const evidence: PaymentEvidence = { payment_id: "123", order_id: "deposit:abc", payment_status: "finished", pay_currency: "merchant-verified-ticker", outcome_currency: "merchant-verified-ticker", pay_amount: "100", actually_paid: "100", outcome_amount: "99.5", pay_address: "address", payin_extra_id: null, payin_hash: "transaction" };
const expected = { paymentId: "123", reference: "deposit:abc", currency: "merchant-verified-ticker", address: "address", memo: null, requestedAtoms: 100_000_000n, quoteExpiredBeforeDetection: false };
afterEach(() => { vi.unstubAllGlobals(); });

describe("NOWPayments evidence boundary", () => {
  it("preserves original monetary digits and rejects duplicate keys", () => {
    expect(parseProviderJson('{"amount":9007199254740993,"fee":0.000001}')).toEqual({ amount: "9007199254740993", fee: "0.000001" });
    expect(() => parseProviderJson('{"amount":1,"amount":2}')).toThrow();
  });
  it("rejects deeply nested or oversized provider input", () => {
    expect(() => parseProviderJson("[".repeat(33) + "0" + "]".repeat(33))).toThrow("nesting");
    expect(() => parseProviderJson('"' + "a".repeat(262_144) + '"')).toThrow("size");
  });
  it("keeps execution disabled independently of environment toggles", () => {
    vi.stubEnv("FINANCIAL_EXECUTION_ENABLED", "true");
    expect(() => assertFinancialExecutionEnabled()).toThrow("unavailable");
    vi.unstubAllEnvs();
  });
  it("encrypts retained evidence with a fresh nonce and no plaintext", () => {
    const first = encryptEvidence("private provider body", "a".repeat(64), "v1", "b".repeat(64));
    const second = encryptEvidence("private provider body", "a".repeat(64), "v1", "b".repeat(64));
    expect(first).not.toBe(second);
    expect(first).not.toContain("private provider body");
    expect(() => encryptEvidence("body", "invalid", "v1", "b".repeat(64))).toThrow();
  });
  it("verifies documented HMAC canonicalization independently of key ordering", () => {
    const canonical = '{"a":1,"fee":{"a":2,"z":3},"z":"value"}';
    const signature = createHmac("sha512", "secret").update(canonical).digest("hex");
    const first = verifyIpn('{"z":"value","fee":{"z":3,"a":2},"a":1}', signature, "secret");
    expect(first?.payload).toEqual({ z: "value", fee: { z: "3", a: "2" }, a: "1" });
    expect(verifyIpn(canonical, signature, "secret")?.digest).toBe(first?.digest);
    expect(verifyIpn(canonical, signature, "wrong")).toBeNull();
    expect(verifyIpn(canonical, signature + "00", "secret")).toBeNull();
    expect(verifyIpn(canonical.replace('"a":1', '"a":2'), signature, "secret")).toBeNull();
  });
  it("rejects numeric signature collisions without losing precision in authoritative lookups", () => {
    const signature = createHmac("sha512", "secret").update('{"amount":9007199254740992}').digest("hex");
    expect(verifyIpn('{"amount":9007199254740993}', signature, "secret")).toBeNull();
    expect(parseProviderJson('{"amount":9007199254740993}')).toEqual({ amount: "9007199254740993" });
    const decimalSignature = createHmac("sha512", "secret").update('{"amount":0.1}').digest("hex");
    expect(verifyIpn('{"amount":0.10000000000000001}', decimalSignature, "secret")).toBeNull();
    expect(verifyIpn('{"amount":0.100000}', decimalSignature, "secret")?.payload).toEqual({ amount: "0.100000" });
  });
  it("rejects malformed or duplicate-key signed payloads", () => {
    const signature = "a".repeat(128);
    expect(verifyIpn('{"amount":1,"amount":2}', signature, "secret")).toBeNull();
    expect(verifyIpn("not json", signature, "secret")).toBeNull();
  });
  it("does not equate processing success with wallet credit", () => {
    expect(classifyDeposit(evidence, expected)).toBe("eligible_for_reconciliation");
    expect(classifyDeposit({ ...evidence, payment_status: "confirmed" }, expected)).toBe("confirming");
    expect(classifyDeposit({ ...evidence, payment_status: "finished", payin_hash: null }, expected)).toBe("manual_review");
  });
  it("handles decimal zero and sends unsupported amounts to review without rounding", () => {
    expect(classifyDeposit({ ...evidence, payment_status: "waiting", actually_paid: "0.000000", outcome_amount: "0.0" }, expected)).toBe("awaiting_payment");
    expect(classifyDeposit({ ...evidence, outcome_amount: "0" }, expected)).toBe("manual_review");
    expect(classifyDeposit({ ...evidence, outcome_amount: "99.1234567" }, expected)).toBe("manual_review");
  });
  it("stops an oversized response stream before reading the rest", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(262_145)); }, cancel });
    await expect(readProviderBody(new Response(body))).rejects.toThrow("invalid_evidence");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("categorizes malformed successful provider responses without exposing their contents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private upstream error")));
    await expect(lookupPayment("123", "key")).rejects.toThrow("invalid_evidence");
  });
  it("routes partial, excess, repeated, wrong-asset and late transfers to explicit states", () => {
    expect(classifyDeposit({ ...evidence, actually_paid: "99" }, expected)).toBe("partial_payment");
    expect(classifyDeposit({ ...evidence, actually_paid: "101" }, expected)).toBe("overpayment");
    expect(classifyDeposit({ ...evidence, parent_payment_id: "122" }, expected)).toBe("manual_review");
    expect(classifyDeposit({ ...evidence, outcome_currency: "other" }, expected)).toBe("wrong_asset_or_network");
    expect(classifyDeposit(evidence, { ...expected, quoteExpiredBeforeDetection: true })).toBe("late_payment");
  });
  it.each(["FAILED", "creating", "processing", "cancelled", "unknown"])("retains withdrawal reservations for %s", status => {
    expect(payoutDisposition(status)).toBe("retain_reservation");
  });
  it("requires authoritative final payout evidence", () => {
    expect(payoutDisposition("FINISHED")).toBe("completed_evidence");
    expect(payoutDisposition("REJECTED")).toBe("rejected_evidence");
  });
  it("does not retry provider timeouts or interpret them as nonpayment", async () => {
    const request = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", request);
    await expect(lookupPayment("123", "key")).rejects.toThrow("transport");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects a successful lookup for another payment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...evidence, payment_id: "456" }))));
    await expect(lookupPayment("123", "key")).rejects.toThrow("invalid_evidence");
  });
});

it("distinguishes network-precision pay-in amounts from actual net USDT settlement", () => {
  const converted = { ...evidence, pay_currency: "verified-btc", pay_amount: "0.00123456", actually_paid: "0.00123456", outcome_amount: "99.5" };
  const conversion = { ...expected, currency: "verified-btc", decimals: 8, requestedAtoms: 123456n, settlementCurrency: evidence.outcome_currency };
  expect(classifyDeposit(converted, conversion)).toBe("eligible_for_reconciliation");
  expect(classifyDeposit({ ...converted, actually_paid: "0.001234567" }, conversion)).toBe("manual_review");
  expect(classifyDeposit({ ...converted, outcome_currency: "btc" }, conversion)).toBe("wrong_asset_or_network");
  expect(classifyDeposit({ ...converted, outcome_amount: null }, conversion)).toBe("manual_review");
  expect(classifyDeposit({ ...converted, payment_status: "waiting", actually_paid: null, outcome_amount: null }, conversion)).toBe("awaiting_payment");
});
