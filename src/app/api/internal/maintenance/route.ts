import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
function validSecret(value: string | null) { if (!env.MAINTENANCE_SECRET || !value) return false; const provided = Buffer.from(value.replace(/^Bearer /, "")); const expected = Buffer.from(env.MAINTENANCE_SECRET); return provided.length === expected.length && timingSafeEqual(provided, expected); }
export async function POST(request: Request) { if (!validSecret(request.headers.get("authorization"))) return Response.json({ error: "Unauthorized" }, { status: 401 }); return Response.json({ ok: true, tasks: ["expired-verifications", "orphaned-uploads", "view-rollups"] }); }
