import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThreadRow } from "@/components/thread-row";
import { demoThreads } from "@/data/demo";

describe("ThreadRow", () => {
  it("exposes title, creator, reply count, and state labels", () => {
    render(<ThreadRow thread={demoThreads[0]} />);
    expect(screen.getByRole("link", { name: demoThreads[0].title })).toHaveAttribute("href", `/threads/${demoThreads[0].id}/${demoThreads[0].slug}`);
    expect(screen.getByRole("link", { name: demoThreads[0].creator })).toBeInTheDocument();
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
    expect(
      screen.getByText(demoThreads[0].replies.toLocaleString("en-US")),
    ).toBeInTheDocument();
  });
});
