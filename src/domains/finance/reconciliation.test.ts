// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/db/client", () => ({ createReadDatabase: () => ({ select: () => ({ from }) }) }));
import { reconcileLedger } from "./reconciliation";

it("separates retained platform fees from member liabilities", async () => {
  from.mockResolvedValue([
    { id: "member", currency: "USDT", kind: "available", balance: "50000000" },
    { id: "revenue", currency: "USDT", kind: "platform_revenue", balance: "1000000" },
    { id: "backing", currency: "USDT", kind: "backing", balance: "-51000000" },
  ]);
  expect(await reconcileLedger()).toMatchObject({ memberLiabilityAtoms: "50000000", platformRevenueAtoms: "1000000", backingBookAtoms: "51000000", balanced: true, issues: [], providerBackingVerified: false, financialExecutionEnabled: true });
});

it("reports an accounting mismatch without pretending that balanced books prove custody", async () => {
  from.mockResolvedValue([
    { id: "member", currency: "USDT", kind: "reserved", balance: "50000000" },
    { id: "revenue", currency: "USDT", kind: "platform_revenue", balance: "1000000" },
    { id: "backing", currency: "USDT", kind: "backing", balance: "-50000000" },
  ]);
  expect(await reconcileLedger()).toMatchObject({ balanced: false, providerBackingVerified: false });
});

it("identifies negative revenue independently of negative member balances", async () => {
  from.mockResolvedValue([{ id: "revenue", currency: "USDT", kind: "platform_revenue", balance: "-1" }]);
  expect(await reconcileLedger()).toMatchObject({ memberLiabilityAtoms: "0", issues: [{ accountId: "revenue", reason: "negative_platform_revenue" }] });
});
