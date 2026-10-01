import { describe, expect, it } from "vitest";
import { formatUsdt, MAX_ATOMS, parseUsdt, positiveUsdt } from "./money";
import { assertFinancePermission, assertIndependentApproval, validateWithdrawalLimit } from "./policy";

describe("USDT exact accounting", () => {
  it("retains micro-USDT and amounts above Number's safe integer range", () => {
    expect(parseUsdt("0.000001")).toBe(1n);
    expect(parseUsdt("9007199254.740993")).toBe(9_007_199_254_740_993n);
    expect(parseUsdt(formatUsdt(MAX_ATOMS))).toBe(MAX_ATOMS);
    expect(formatUsdt(-1n)).toBe("-0.000001");
    expect(formatUsdt(20_100_000n)).toBe("20.1");
  });
  it.each(["1e3", "NaN", "Infinity", "-1", "+1", "01", "1.0000001", " 1", "1,000", "9223372036854.775808"])("rejects invalid amount %s without rounding", value => {
    expect(() => parseUsdt(value)).toThrow();
  });
  it("rejects zero-valued mutations", () => expect(() => positiveUsdt("0")).toThrow());
  it("includes reserved withdrawals in rolling limits", () => {
    expect(() => validateWithdrawalLimit(500_000_000n, 500_000_000n)).not.toThrow();
    expect(() => validateWithdrawalLimit(500_000_000n, 500_000_001n)).toThrow("24-hour");
    expect(() => validateWithdrawalLimit(19_999_999n, 0n)).toThrow("Minimum");
    expect(() => validateWithdrawalLimit(500_000_001n, 0n)).toThrow("Maximum");
  });
  it("does not treat administrator access as treasury authority", () => {
    expect(() => assertFinancePermission(["admin.manage"], "finance.treasury")).toThrow("FORBIDDEN");
    expect(() => assertFinancePermission(["finance.treasury"], "finance.treasury")).not.toThrow();
    expect(() => assertIndependentApproval("alice", "alice", "buyer")).toThrow();
    expect(() => assertIndependentApproval("alice", "buyer", "buyer")).toThrow();
    expect(() => assertIndependentApproval("alice", "bob", "buyer")).not.toThrow();
  });
});
