import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/lib/cursor";

describe("cursor codec", () => {
  it("round trips a valid signed cursor", () => {
    const value = { v: 1 as const, sort: "latest", id: 42, at: "2026-07-28T12:00:00.000Z", pinned: false };
    expect(decodeCursor(encodeCursor(value, "test-secret"), "test-secret")).toEqual(value);
  });
  it("rejects tampering", () => {
    const cursor = encodeCursor({ v: 1, sort: "latest", id: 42 }, "test-secret");
    expect(decodeCursor(`${cursor}x`, "test-secret")).toBeNull();
  });
});
