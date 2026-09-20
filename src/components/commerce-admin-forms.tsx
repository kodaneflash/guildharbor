"use client";
import { useActionState } from "react";
import { categoryAction, commerceModerationAction } from "@/app/(product)/admin/marketplace-categories/actions";
type Category = { id: string; name: string; slug: string; parentId: string | null; archivedAt: Date | null };
export function CategoryForm({ category, categories }: { category?: Category; categories: Category[] }) {
  const [state, action, pending] = useActionState(categoryAction, { message: "" });
  return <form action={action} className="surface space-y-3 p-5"><input type="hidden" name="id" value={category?.id ?? ""} /><label className="block">Name<input className="field mt-2" name="name" defaultValue={category?.name} minLength={2} maxLength={80} required /></label><label className="block">Slug<input className="field mt-2" name="slug" defaultValue={category?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} required /></label><label className="block">Parent<select className="field mt-2" name="parentId" defaultValue={category?.parentId ?? ""}><option value="">No parent</option>{categories.filter(item => item.id !== category?.id && !item.archivedAt).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="flex gap-3"><button className="button-primary" name="operation" value="save" disabled={pending}>Save category</button>{category && <button className="button-secondary" name="operation" value={category.archivedAt ? "restore" : "archive"} disabled={pending}>{category.archivedAt ? "Restore" : "Archive"}</button>}</div><p role="status">{state.message}</p></form>;
}
export function CommerceModerationForm({ id, kind, inactive }: { id: string; kind: "listing" | "seller"; inactive: boolean }) {
  const [state, action, pending] = useActionState(commerceModerationAction, { message: "" });
  return <form action={action} className="space-y-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} /><label className="block">Moderation reason<textarea className="field mt-2" name="reason" minLength={5} maxLength={2000} required /></label><button className="button-secondary" name="operation" value={inactive ? "restore" : kind === "listing" ? "remove" : "suspend"} disabled={pending}>{inactive ? "Restore" : kind === "listing" ? "Remove listing" : "Suspend seller"}</button><p role="status">{state.message}</p></form>;
}
