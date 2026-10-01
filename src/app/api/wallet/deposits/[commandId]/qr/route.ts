import { z } from "zod";
import QRCode from "qrcode";
import { financialServicingEnabled } from "@/domains/finance/gate";
import { depositView } from "@/domains/finance/deposit-view";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ commandId: string }> }) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  if (!financialServicingEnabled) return new Response(null, { status: 503, headers: privateHeaders });
  const id = z.uuid().safeParse((await params).commandId);
  const view = id.success ? await depositView(id.data, access.user.id) : null;
  if (!view?.instructions) return new Response(null, { status: 404, headers: privateHeaders });
  // Address-only QR. The user must select the specified asset/network and enter the displayed amount.
  const png = await QRCode.toBuffer(view.instructions.address, { type: "png", width: 288, margin: 4, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), { headers: { ...privateHeaders, "Content-Type": "image/png", "Content-Security-Policy": "default-src 'none'" } });
}
