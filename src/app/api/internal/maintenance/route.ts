import { runMaintenance } from "@/domains/notifications/maintenance";
import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { recoverDeposits } from "@/domains/finance/deposit-recovery";
import { settleSellerHolds } from "@/domains/finance/seller-orders";
export const maxDuration = 300;

function validSecret(value: string | null) {
  if (!env.MAINTENANCE_SECRET || !value) return false;
  const provided = Buffer.from(value.replace(/^Bearer /, ""));
  const expected = Buffer.from(env.MAINTENANCE_SECRET);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
export async function POST(request: Request) {
  if (!validSecret(request.headers.get("authorization")))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [result, deposits, sellerHolds] = await Promise.all([runMaintenance(), recoverDeposits(), settleSellerHolds()]);
  return Response.json({ ...result, deposits, sellerHolds }, { status: result.failed || result.telegram.failed || deposits.failed || sellerHolds.failed ? 503 : 200, headers: { "Cache-Control": "private, no-store" } });
}
