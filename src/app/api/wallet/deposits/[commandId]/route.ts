import { z, ZodError } from "zod";
import { financialServicingEnabled } from "@/domains/finance/gate";
import { depositView } from "@/domains/finance/deposit-view";
import { observeDeposit } from "@/domains/finance/deposit-observation";
import { ProviderReadError } from "@/domains/finance/nowpayments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";

export async function GET(request: Request, { params }: { params: Promise<{ commandId: string }> }) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  if (!financialServicingEnabled) return Response.json({ error: "Deposits are not activated." }, { status: 503, headers: privateHeaders });
  const id = z.uuid().safeParse((await params).commandId);
  if (!id.success) return new Response(null, { status: 404, headers: privateHeaders });
  const view = await depositView(id.data, access.user.id);
  if (!view) return new Response(null, { status: 404, headers: privateHeaders });
  return Response.json(view, { headers: privateHeaders });
}

export async function POST(request: Request, { params }: { params: Promise<{ commandId: string }> }) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  if (!financialServicingEnabled) return Response.json({ error: "Deposits are not activated." }, { status: 503, headers: privateHeaders });
  const id = z.uuid().safeParse((await params).commandId);
  const view = id.success ? await depositView(id.data, access.user.id) : null;
  if (!view) return new Response(null, { status: 404, headers: privateHeaders });
  if (["preparing", "outcome_unknown"].includes(view.status)) return Response.json(view, { headers: privateHeaders });
  try {
    await enforceRateLimit("depositRefresh", access.user.id);
    await observeDeposit(view.id, access.user.id);
  } catch (error) {
    if (error instanceof ProviderReadError || error instanceof ZodError) return Response.json({ error: "Provider status is temporarily unavailable. Your deposit remains recorded; do not pay again." }, { status: 503, headers: privateHeaders });
    if (error instanceof Error && error.message === "RATE_LIMITED") return Response.json({ error: "Please wait before refreshing again." }, { status: 429, headers: privateHeaders });
    throw error;
  }
  return Response.json(await depositView(view.id, access.user.id), { headers: privateHeaders });
}
