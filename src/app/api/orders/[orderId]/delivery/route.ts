import { createDecipheriv } from "node:crypto";
import { buyerOrder } from "@/domains/finance/orders";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  const row = await buyerOrder((await params).orderId);
  if (!row || !row.deliveryAllowed || !["paid", "completed"].includes(row.order.status) || row.order.refundJournalId ||
    !["text", "manual"].includes(row.revision.fulfillmentMode)) {
    return new Response(null, { status: 404, headers: privateHeaders });
  }
  const payload = row.revision.fulfillmentMode === "manual" ? row.fulfillment : row.revision.protectedText;
  if (!payload) return new Response(null, { status: 404, headers: privateHeaders });
  const key = process.env.DELIVERY_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("Protected delivery key unavailable");
  const [version, nonce, tag, ciphertext] = payload.split(":");
  if (version !== "v1" || !nonce || !tag || !ciphertext) throw new Error("Unsupported protected payload");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(nonce, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const content = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
  return new Response(content, { headers: { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": "attachment; filename=delivery.txt", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}
