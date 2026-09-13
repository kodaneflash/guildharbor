import { Fragment, type ReactNode } from "react";
import { richTextDocumentSchema, type RichTextNode } from "@/lib/rich-text";
function nodeContent(node: RichTextNode): ReactNode {
  const children = node.content?.map((child, index) => (
    <Fragment key={index}>{nodeContent(child)}</Fragment>
  ));
  if (node.type === "text") {
    return (node.marks ?? []).reduce<ReactNode>((text, mark) => {
      if (mark.type === "bold") return <strong>{text}</strong>;
      if (mark.type === "italic") return <em>{text}</em>;
      if (mark.type === "strike") return <s>{text}</s>;
      if (mark.type === "code") return <code>{text}</code>;
      if (
        mark.type === "link" &&
        /^(https?:|mailto:)/i.test(mark.attrs?.href ?? "")
      )
        return (
          <a href={mark.attrs?.href} rel="nofollow ugc noopener noreferrer">
            {text}
          </a>
        );
      return text;
    }, node.text);
  }
  switch (node.type) {
    case "paragraph":
      return <p>{children}</p>;
    case "heading":
      return node.attrs?.level === 3 ? (
        <h3>{children}</h3>
      ) : (
        <h2>{children}</h2>
      );
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre>
          <code>{children}</code>
        </pre>
      );
    case "hardBreak":
      return <br />;
    default:
      return children;
  }
}
export function renderRichText(content: unknown) {
  return nodeContent(richTextDocumentSchema.parse(content));
}
