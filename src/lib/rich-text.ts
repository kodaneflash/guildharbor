import sanitizeHtml from "sanitize-html";
import { z } from "zod";

const markSchema = z.object({
  type: z.enum(["bold", "italic", "strike", "code", "link"]),
  attrs: z.object({ href: z.string().url().optional() }).strict().optional(),
}).strict();

export type RichTextNode = {
  type: string;
  attrs?: Record<string, string | number | boolean | null>;
  text?: string;
  marks?: Array<z.infer<typeof markSchema>>;
  content?: RichTextNode[];
};

const richTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.enum(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "hardBreak", "mention"]),
    attrs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    text: z.string().max(20_000).optional(),
    marks: z.array(markSchema).max(8).optional(),
    content: z.array(richTextNodeSchema).max(500).optional(),
  }).strict(),
);

export const richTextDocumentSchema = richTextNodeSchema.refine((node) => node.type === "doc", "Root node must be a document");
export type RichTextDocument = RichTextNode;

export function extractPlainText(document: RichTextDocument) {
  const chunks: string[] = [];
  function visit(node: RichTextNode) {
    if (node.text) chunks.push(node.text);
    node.content?.forEach(visit);
    if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type)) chunks.push("\n");
  }
  visit(document);
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export function sanitizeRenderedRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "s", "code", "pre", "h2", "h3", "ul", "ol", "li", "blockquote", "a"],
    allowedAttributes: { a: ["href", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attributes) => ({ tagName: "a", attribs: { href: attributes.href ?? "#", rel: "nofollow ugc noopener noreferrer" } }),
    },
  });
}
