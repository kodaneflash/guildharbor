import { describe, expect, it } from "vitest";

import { extractPlainText, sanitizeRenderedRichText } from "@/lib/rich-text";

describe("rich text safety", () => {
  it("extracts searchable text", () => expect(extractPlainText({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello harbor" }] }] })).toBe("Hello harbor"));
  it("removes scripts and unsafe links", () => expect(sanitizeRenderedRichText('<script>alert(1)</script><a href="javascript:alert(1)">bad</a>')).toBe('<a rel="nofollow ugc noopener noreferrer">bad</a>'));
});
