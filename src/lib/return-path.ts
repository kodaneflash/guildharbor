/** Only local product destinations; authentication and machine endpoints cannot become redirect loops. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || (/[\\\s]|%0[ad]|%5c/i.test(value) || [...value].some(character => character.charCodeAt(0) < 32))) return "/";
  if (!URL.canParse(value, "https://guildharbor.invalid")) return "/";
  const url = new URL(value, "https://guildharbor.invalid");
  if (url.origin !== "https://guildharbor.invalid" || /^\/(?:api|feeds|sign-in|sign-up|forgot-password|reset-password|verify-email|two-factor|onboarding)(?:\/|$)/.test(url.pathname)) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
export const authenticationPaths = new Set(["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/two-factor", "/onboarding/username"]);
