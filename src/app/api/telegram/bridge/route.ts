import { bridgeAuthorized, disconnectTelegramById, redeemTelegramLink, telegramConnectionById } from "@/domains/notifications/telegram";
import { deliverTelegramNotifications } from "@/domains/notifications/maintenance";

export async function POST(request: Request) {
  if (!bridgeAuthorized(request.headers.get("authorization"))) return Response.json({ status: "unauthorized" }, { status: 401 });
  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null || !("action" in body)) return Response.json({ status: "invalid" }, { status: 400 });
  if (body.action === "redeem") {
    const result = await redeemTelegramLink(body);
    return Response.json(result, { status: result.status === "connected" ? 200 : 409 });
  }
  if (body.action === "disconnect" && "telegramUserId" in body && typeof body.telegramUserId === "string") {
    return Response.json({ status: (await disconnectTelegramById(body.telegramUserId)) ? "disconnected" : "not_connected" });
  }
  if (body.action === "status" && "telegramUserId" in body && typeof body.telegramUserId === "string") {
    return Response.json(await telegramConnectionById(body.telegramUserId));
  }
  if (body.action === "dispatch") {
    return Response.json(await deliverTelegramNotifications());
  }
  return Response.json({ status: "invalid" }, { status: 400 });
}
