import { z } from "zod";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { newPurchasesEnabled } from "@/domains/finance/gate";
import { CheckoutUnavailable, purchaseCheckout } from "@/domains/finance/checkout";
import { PurchaseUnavailable } from "@/domains/finance/purchase-flow";
import { ProviderReadError, readProviderBody } from "@/domains/finance/nowpayments";

export async function POST(request: Request, { params }: { params: Promise<{ checkoutId: string }> }) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  if (!newPurchasesEnabled) return Response.json({ error: "Paid checkout is not activated." }, { status: 503, headers: privateHeaders });
  const id = z.uuid().safeParse((await params).checkoutId);
  if (!id.success) return new Response(null, { status: 404, headers: privateHeaders });
  let payload: unknown;
  try { payload = JSON.parse(await readProviderBody(new Response(request.body))); }
  catch { return Response.json({ error: "Invalid confirmation." }, { status: 400, headers: privateHeaders }); }
  const consent = z.object({ confirmed: z.literal(true), total: z.string().regex(/^(0|[1-9]\d*)(?:\.\d{1,6})?$/).max(30) }).strict().safeParse(payload);
  if (!consent.success) return Response.json({ error: "Confirm the displayed USDT total." }, { status: 400, headers: privateHeaders });
  try {
    await enforceRateLimit("checkout", access.user.id);
    const orders = await purchaseCheckout(access.user.id, id.data, consent.data.total);
    return Response.json({ orderIds: orders.map(order => order.id) }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof CheckoutUnavailable || error instanceof PurchaseUnavailable) return Response.json({ error: error.message }, { status: 409, headers: privateHeaders });
    if (error instanceof ProviderReadError) return Response.json({ error: "Settlement reconciliation is unavailable. Check your orders before retrying this confirmation." }, { status: 503, headers: privateHeaders });
    if (error instanceof Error && error.message === "RATE_LIMITED") return Response.json({ error: "Please wait before retrying the same checkout." }, { status: 429, headers: privateHeaders });
    if (error instanceof Error && ["FORBIDDEN", "Financial account requires review."].includes(error.message)) return Response.json({ error: "Financial account requires review." }, { status: 403, headers: privateHeaders });
    throw error;
  }
}
