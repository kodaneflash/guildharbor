"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code2, Heading2, Italic, List, ListOrdered, Quote } from "lucide-react";
import { useState } from "react";

const initialContent = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }] };

export function RichTextEditor({ name = "content" }: { name?: string }) {
  const [serializedContent, setSerializedContent] = useState(() => JSON.stringify(initialContent));
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    immediatelyRender: false,
    onUpdate({ editor: currentEditor }) {
      setSerializedContent(JSON.stringify(currentEditor.getJSON()));
    },
    editorProps: { attributes: { class: "min-h-56 px-4 py-4 text-body-sm leading-7 text-text-secondary outline-none" } },
  });

  if (!editor) return <div className="h-64 animate-pulse rounded-md bg-panel" />;
  const tools = [
    { label: "Bold", icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { label: "Italic", icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { label: "Heading", icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { label: "Bulleted list", icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { label: "Numbered list", icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
    { label: "Quote", icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote") },
    { label: "Code", icon: Code2, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive("codeBlock") },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-border-strong bg-page focus-within:ring-2 focus-within:ring-focus">
      <div className="flex flex-wrap gap-1 border-b border-border bg-panel p-2" role="toolbar" aria-label="Post formatting">
        {tools.map(({ label, icon: Icon, action, active }) => <button key={label} type="button" aria-label={label} aria-pressed={active} onClick={action} className={`grid size-9 place-items-center rounded-[5px] text-text-muted hover:bg-panel-raised hover:text-text ${active ? "bg-panel-strong text-cyan" : ""}`}><Icon className="size-4" /></button>)}
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={serializedContent} readOnly />
    </div>
  );
}
