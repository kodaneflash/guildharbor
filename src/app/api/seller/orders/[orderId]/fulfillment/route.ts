import { z } from "zod";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fulfillmentSchema, FulfillmentUnavailable, submitFulfillment } from "@/domains/finance/seller-orders";
import { readProviderBody } from "@/domains/finance/nowpayments";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  const id = z.uuid().safeParse((await params).orderId);
  if (!id.success) return new Response(null, { status: 404, headers: privateHeaders });
  let payload: unknown;
  try { payload = JSON.parse(await readProviderBody(new Response(request.body))); }
  catch { return Response.json({ error: "Invalid fulfillment." }, { status: 400, headers: privateHeaders }); }
  const data = fulfillmentSchema.safeParse(payload);
  if (!data.success) return Response.json({ error: "Enter fulfillment details up to 100,000 characters." }, { status: 400, headers: privateHeaders });
  try {
    await enforceRateLimit("fulfillment", access.user.id);
    await submitFulfillment(access.user.id, id.data, data.data);
    return Response.json({ completed: true }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof FulfillmentUnavailable) return Response.json({ error: error.message }, { status: 409, headers: privateHeaders });
    if (error instanceof Error && error.message === "RATE_LIMITED") return Response.json({ error: "Please wait before retrying." }, { status: 429, headers: privateHeaders });
    if (error instanceof Error && ["FORBIDDEN", "Financial account requires review."].includes(error.message)) return Response.json({ error: "Financial account requires review." }, { status: 403, headers: privateHeaders });
    throw error;
  }
}
