import { describe, expect, it } from "vitest";
import { withdrawalBreakdown } from "./withdrawal-fees";

const breakdown = (debitAmount: string, providerAndNetworkFeeAmount = "0", rollingDayDebitAtoms = 0n) =>
  withdrawalBreakdown({ debitAmount, providerAndNetworkFeeAmount, rollingDayDebitAtoms });

describe("one-percent withdrawal fee", () => {
  it("deducts a single platform fee and explicit external costs from total debit", () => {
    expect(breakdown("100", "0.2")).toMatchObject({ debitAtoms: 100_000_000n, platformFeeAtoms: 1_000_000n, providerAndNetworkFeeAtoms: 200_000n, recipientAtoms: 98_800_000n, externalDebitAtoms: 99_000_000n });
  });
  it("never exceeds one percent when rounding at micro-USDT precision", () => {
    const quote = breakdown("100.000099");
    expect(quote.platformFeeAtoms).toBe(1_000_000n);
    expect(quote.recipientAtoms).toBe(99_000_099n);
    expect(quote.platformFeeAtoms * 100n).toBeLessThanOrEqual(quote.debitAtoms);
  });
  it("applies the same fee at minimum and maximum without exemptions", () => {
    expect(breakdown("20").platformFeeAtoms).toBe(200_000n);
    expect(breakdown("500").platformFeeAtoms).toBe(5_000_000n);
  });
  it("uses total debit, not net received, for per-request and rolling limits", () => {
    expect(() => breakdown("500.000001")).toThrow("Maximum");
    expect(() => breakdown("500", "0", 500_000_001n)).toThrow("24-hour");
    expect(() => breakdown("500", "0", 500_000_000n)).not.toThrow();
  });
  it.each(["99", "100", "1000"])("rejects costs of %s when they leave no recipient amount", cost => {
    expect(() => breakdown("100", cost)).toThrow("no payable amount");
  });
  it.each(["-1", "0.0000001", "NaN", "1e2"])("rejects invalid third-party fees %s", cost => {
    expect(() => breakdown("100", cost)).toThrow();
  });
  it("conserves every atomic unit across a range of fractional amounts", () => {
    for (let fraction = 0n; fraction < 100n; fraction++) {
      const quote = breakdown(`20.${fraction.toString().padStart(6, "0")}`, "0.01");
      expect(quote.recipientAtoms + quote.providerAndNetworkFeeAtoms + quote.platformFeeAtoms).toBe(quote.debitAtoms);
      expect(quote.externalDebitAtoms + quote.platformFeeAtoms).toBe(quote.debitAtoms);
    }
  });
});
