import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { newPurchasesEnabled } from "@/domains/finance/gate";
import { checkoutRequestSchema, CheckoutUnavailable, issueCheckout } from "@/domains/finance/checkout";
import { ProviderReadError, readProviderBody } from "@/domains/finance/nowpayments";
import { ZodError } from "zod";

export async function POST(request: Request) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  if (!newPurchasesEnabled) return Response.json({ error: "Paid checkout is not activated." }, { status: 503, headers: privateHeaders });
  let payload: unknown;
  try { payload = JSON.parse(await readProviderBody(new Response(request.body))); }
  catch { return Response.json({ error: "Invalid checkout request." }, { status: 400, headers: privateHeaders }); }
  const input = checkoutRequestSchema.safeParse(payload);
  if (!input.success) return Response.json({ error: "Select valid products before requesting a quote." }, { status: 400, headers: privateHeaders });
  try {
    await enforceRateLimit("checkout", access.user.id);
    const view = await issueCheckout(access.user.id, input.data);
    return Response.json(view, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof CheckoutUnavailable) return Response.json({ error: error.message }, { status: 409, headers: privateHeaders });
    if (error instanceof ProviderReadError || error instanceof ZodError) return Response.json({ error: "The USDT quote is unavailable. No purchase has been made." }, { status: 503, headers: privateHeaders });
    if (error instanceof Error && error.message === "RATE_LIMITED") return Response.json({ error: "Please wait before requesting another quote." }, { status: 429, headers: privateHeaders });
    if (error instanceof Error && ["FORBIDDEN", "Financial account requires review."].includes(error.message)) return Response.json({ error: "Financial account requires review." }, { status: 403, headers: privateHeaders });
    throw error;
  }
}
