import { runMaintenance } from "@/domains/notifications/maintenance";
import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
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
  const result = await runMaintenance();
  return Response.json(result, { status: result.failed ? 503 : 200, headers: { "Cache-Control": "private, no-store" } });
}
