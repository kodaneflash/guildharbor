import { z } from "zod";
import { extractPlainText, richTextDocumentSchema } from "@/lib/rich-text";

export const announcementInputSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Enter a title.").max(160),
  content: z.string().max(100_000, "Announcement content is too large.").transform((value, context) => {
    // JSON is untrusted form input; report malformed input without hiding other failures.
    let document: unknown;
    try { document = JSON.parse(value); } catch {
      context.addIssue({ code: "custom", message: "Invalid announcement content." });
      return z.NEVER;
    }
    // Bound depth and node count before invoking the recursive document schema.
    const pending: { value: unknown; depth: number }[] = [{ value: document, depth: 0 }];
    let nodes = 0;
    while (pending.length) {
      const entry = pending.pop();
      if (!entry) break;
      if (++nodes > 5_000 || entry.depth > 50) {
        context.addIssue({ code: "custom", message: "Announcement content is too complex." });
        return z.NEVER;
      }
      if (entry.value && typeof entry.value === "object") {
        for (const child of Object.values(entry.value)) pending.push({ value: child, depth: entry.depth + 1 });
      }
    }
    return document;
  }).pipe(richTextDocumentSchema).superRefine((document, context) => {
    const text = extractPlainText(document);
    if (!text.length) context.addIssue({ code: "custom", message: "Enter announcement content." });
    if (text.length > 20_000) context.addIssue({ code: "custom", message: "Content must contain at most 20,000 characters." });
  }),
  pinned: z.boolean(),
  important: z.boolean(),
});

export function announcementTelegramText(title: string, content: unknown, href: string) {
  const plain = extractPlainText(richTextDocumentSchema.parse(content));
  const excerpt = Array.from(plain).slice(0, 500).join("");
  return `Outlaw Team announcement\n${title}\n\n${excerpt}\n\n${href}\nManage alerts in your account settings.`;
}
