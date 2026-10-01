import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { newDepositsEnabled } from "@/domains/finance/gate";
import { createDeposit, DepositRateLimited, DepositUnavailable } from "@/domains/finance/deposit-creation";
import { approvedDepositAssets } from "@/domains/finance/assets";
import { depositRequestSchema } from "@/domains/finance/deposit-provider";
import { ProviderReadError, readProviderBody } from "@/domains/finance/nowpayments";
import { ZodError } from "zod";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  if (!newDepositsEnabled) return Response.json({ error: "Deposits are not activated." }, { status: 503, headers: privateHeaders });
  let payload: unknown;
  try { payload = JSON.parse(await readProviderBody(new Response(request.body))); }
  catch { return Response.json({ error: "Invalid deposit request." }, { status: 400, headers: privateHeaders }); }
  const input = depositRequestSchema.safeParse(payload);
  if (!input.success || !approvedDepositAssets().some(asset => asset.ticker === input.data.currency)) return Response.json({ error: "Choose an approved asset and network and enter a positive USD amount with at most two decimal places." }, { status: 400, headers: privateHeaders });
  try {
    return Response.json(await createDeposit(access.user.id, input.data), { headers: privateHeaders });
  } catch (error) {
    if (error instanceof DepositRateLimited) return Response.json({ error: error.message, safeToChange: true }, { status: 429, headers: privateHeaders });
    if (error instanceof DepositUnavailable) return Response.json({ error: error.message, safeToChange: error.safeToChange }, { status: 409, headers: privateHeaders });
    if (error instanceof ProviderReadError || error instanceof ZodError) return Response.json({ error: "Provider request unavailable. Retry the same request to recover its status; do not send funds without valid instructions." }, { status: 503, headers: privateHeaders });
    throw error;
  }
}
