import { z } from "zod";

export const profilePreferencesSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(1500),
  telegramHandle: z.string().trim().regex(/^(?:@?[a-zA-Z0-9_]{5,32})?$/, "Enter a valid Telegram username."),
  discordHandle: z.string().trim().regex(/^(?:[a-z0-9_.]{2,32})?$/, "Enter a valid Discord username.").refine(value => !value.includes("..")),
  showTelegram: z.boolean(),
  showDiscord: z.boolean(),
  showLastSeen: z.boolean(),
  preferredContact: z.enum(["email", "telegram", "discord", "any"]),
  locale: z.literal("en"),
  timezone: z.string().max(100).refine(value => {
    if (!value || /^[+-]/.test(value)) return false;
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
    catch { return false; } // Intl is the runtime IANA database and rejects invalid identifiers.
  }, "Choose a valid IANA timezone."),
}).superRefine((value, ctx) => {
  if ((value.preferredContact === "telegram" && !value.telegramHandle) || (value.preferredContact === "discord" && !value.discordHandle)) ctx.addIssue({ code: "custom", path: ["preferredContact"], message: "Configure that contact channel before selecting it." });
});
export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;
