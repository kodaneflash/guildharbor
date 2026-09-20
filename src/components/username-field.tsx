"use client";
import { useEffect, useState } from "react";
import { usernameSchema } from "@/lib/validation";
export function UsernameField() {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState({ value: "", message: "" });
  useEffect(() => {
    if (!value || !usernameSchema.safeParse(value).success) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/is-username-available", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: value.trim().toLowerCase() }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!controller.signal.aborted)
          setFeedback({
            value,
            message: response.ok
              ? result.available
                ? "Username is available."
                : "Username is unavailable."
              : "Unable to check availability. Try again.",
          });
      } catch {
        if (!controller.signal.aborted)
          setFeedback({
            value,
            message: "Unable to check availability. Try again.",
          });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);
  const message = !value
    ? "Use 3–30 letters, numbers, underscores or dots."
    : !usernameSchema.safeParse(value).success
      ? "Choose a valid username that is not reserved."
      : feedback.value === value
        ? feedback.message
        : "Checking availability…";
  return (
    <label className="block">
      <span className="mb-2 block text-body-xs font-bold text-text-secondary">
        Username
      </span>
      <input
        className="field"
        aria-label="Username"
        name="username"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
        minLength={3}
        maxLength={30}
        pattern="[A-Za-z0-9_.]+"
        autoComplete="username"
        aria-describedby="username-availability"
      />
      <span
        id="username-availability"
        role="status"
        className="mt-2 block text-body-xs text-text-muted"
      >
        {message}
      </span>
    </label>
  );
}
