import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UsernameField } from "@/components/username-field";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("debounces availability checks and sends normalized usernames", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValue(Response.json({ available: true }));
  vi.stubGlobal("fetch", fetch);
  render(<UsernameField />);
  const field = screen.getByRole("textbox", { name: "Username" });
  fireEvent.change(field, { target: { value: "Member" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
  fireEvent.change(field, { target: { value: "MemberTwo" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(349);
  });
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    username: "membertwo",
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Username is available.",
  );
});
