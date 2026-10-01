import { eq } from "drizzle-orm";
import { createReadDatabase } from "@/db/client";
import { financialIpnReceipts } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { financialEvidenceConfig } from "@/domains/finance/config";
import { retainEvidence } from "@/domains/finance/commands";
import { financialServicingEnabled } from "@/domains/finance/gate";
import { readProviderBody, verifyIpn } from "@/domains/finance/nowpayments";
import { recoverDepositNotification } from "@/domains/finance/deposit-recovery";

export const runtime = "nodejs";

/** Provider authentication is the signature, not a member cookie or Origin.
 * Acknowledgement means durable receipt ONLY, never wallet credit.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!financialServicingEnabled) return Response.json({ error: "Payment processing is not activated." }, { status: 503, headers });
  const signature = request.headers.get("x-nowpayments-sig");
  if (!signature) return Response.json({ error: "Invalid notification signature." }, { status: 401, headers });
  let config: ReturnType<typeof financialEvidenceConfig>;
  try { config = financialEvidenceConfig(); }
  catch { return Response.json({ error: "Payment processing configuration is incomplete." }, { status: 503, headers }); }
  let body: string;
  try {
    body = await readProviderBody(new Response(request.body));
  } catch {
    return Response.json({ error: "Invalid notification body." }, { status: 400, headers });
  }
  const verified = verifyIpn(body, signature, config.ipnSecret);
  if (!verified) return Response.json({ error: "Invalid notification signature." }, { status: 401, headers });
  const receipt = await withTransaction(async tx => {
    const evidence = await retainEvidence(tx, {
      source: "ipn", digest: verified.digest, body, keyHex: config.keyHex, keyVersion: config.keyVersion,
    });
    await tx.insert(financialIpnReceipts).values({ evidenceId: evidence.id }).onConflictDoNothing();
    const [receipt] = await tx.select().from(financialIpnReceipts).where(eq(financialIpnReceipts.evidenceId, evidence.id));
    return receipt;
  });
  if (receipt.processedAt) return Response.json({ received: true }, { headers });
  try { await recoverDepositNotification(verified.payload); }
  catch {
    // Receipt is durable. Ask the provider to retry; scheduled reconciliation
    // also recovers known payments when a callback is lost entirely.
    return Response.json({ received: true, processing: "retry_required" }, { status: 503, headers });
  }
  await createReadDatabase().update(financialIpnReceipts).set({ processedAt: new Date() }).where(eq(financialIpnReceipts.evidenceId, receipt.evidenceId));
  return Response.json({ received: true }, { headers });
}
