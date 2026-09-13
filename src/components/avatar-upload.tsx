"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/user-avatar";
export function AvatarUpload({
  username,
  avatarUrl,
}: {
  username: string;
  avatarUrl?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(file: File) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      !file.size ||
      file.size > 10485760
    ) {
      setMessage("Choose a JPEG, PNG or WebP image up to 10 MB.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const checksum = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const signedResponse = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "avatar",
          fileName: file.name,
          size: file.size,
          mediaType: file.type,
          checksum,
        }),
      });
      const signed = await signedResponse.json();
      if (!signedResponse.ok) throw new Error(signed.error);
      const uploaded = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
          "x-amz-checksum-sha256": signed.checksum,
        },
        body: file,
      });
      if (!uploaded.ok) throw new Error("Upload failed. Please try again.");
      const completed = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId: signed.attachmentId }),
      });
      const result = await completed.json();
      if (!completed.ok) throw new Error(result.error);
      setMessage("Avatar saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="surface space-y-4 p-6">
      <h2 className="text-xl font-bold">Avatar</h2>
      <UserAvatar seed={username} src={avatarUrl} size="lg" />
      <label className="block text-sm">
        Choose an image
        <input
          className="field mt-2"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-text-muted">
        JPEG, PNG or WebP · up to 10 MB · visible to community members only
      </p>
      <p role="status" className="text-sm">
        {pending ? "Uploading…" : message}
      </p>
    </section>
  );
}
