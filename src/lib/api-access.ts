import "server-only";
import { getAccess } from "@/lib/session";
export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function memberApiAccess(request: Request) {
  const access = await getAccess();
  if (!access.allowed || !access.user)
    return Response.json(
      { error: "Community access required." },
      { status: access.session ? 403 : 401, headers: privateHeaders },
    );
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json(
      { error: "Invalid request origin." },
      { status: 403, headers: privateHeaders },
    );
  return { ...access, user: access.user };
}
