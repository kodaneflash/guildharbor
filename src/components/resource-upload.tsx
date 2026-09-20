"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

const mediaTypes = new Map([
  ["pdf", "application/pdf"],
  ["txt", "text/plain"],
  ["zip", "application/zip"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

async function responseError(response: Response, fallback: string) {
  if (!response.headers.get("content-type")?.includes("application/json")) return fallback;
  const payload: unknown = await response.json();
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export function ResourceUpload({ purpose, resourceId }: { purpose: "listing_media" | "listing_delivery" | "conversation" | "post"; resourceId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (_: { message: string }, form: FormData) => {
    const file = form.get("file"); if (!(file instanceof File) || file.size < 1 || file.size > 10485760) return { message: "Choose a supported file up to 10 MiB." };
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    const mediaType = mediaTypes.get(extension);
    if (!mediaType || (purpose === "listing_media" && !mediaType.startsWith("image/"))) return { message: purpose === "listing_media" ? "Choose a JPEG, PNG or WebP image." : "Choose a PDF, UTF-8 text, ZIP, JPEG, PNG or WebP file." };
    const bytes = await file.arrayBuffer(); const checksum = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const sign = await fetch("/api/resource-uploads/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, resourceId, name: file.name, mediaType, size: file.size, checksum }) });
    if (!sign.ok) return { message: await responseError(sign, "Secure upload is unavailable.") };
    const data: { id: string; url: string } = await sign.json();
    const checksumBytes = new Uint8Array(checksum.match(/.{2}/g)?.map(value => parseInt(value, 16)) ?? []);
    const put = await fetch(data.url, { method: "PUT", headers: { "Content-Type": mediaType, "x-amz-checksum-sha256": btoa(String.fromCharCode(...checksumBytes)) }, body: file });
    if (!put.ok) return { message: "Private storage rejected the upload. No file has been released." };
    const complete = await fetch("/api/resource-uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id }) });
    if (!complete.ok) return { message: await responseError(complete, "The file remains quarantined because secure processing did not complete.") };
    router.refresh(); return { message: purpose === "listing_delivery" ? "File scanned and saved as a new draft delivery revision. Reload the editor before publishing." : "File scanned and attached." };
  }, { message: "" });
  return <form action={action} className="space-y-3"><label className="block">{purpose === "listing_media" ? "Add listing image" : "Attach secure file"}<input className="field mt-2" type="file" name="file" accept={purpose === "listing_media" ? ".jpg,.jpeg,.png,.webp" : ".pdf,.txt,.zip,.jpg,.jpeg,.png,.webp"} required /></label><p className="text-body-xs text-text-muted">{purpose === "listing_media" ? "JPEG, PNG or WebP" : "PDF, UTF-8 TXT, ZIP, JPEG, PNG or WebP"}; up to 10 MiB. Files remain private and quarantined until validation and malware scanning succeed.</p><button className="button-secondary" disabled={pending}>{pending ? "Uploading and scanning…" : "Upload secure file"}</button><p role="status">{state.message}</p></form>;
}
