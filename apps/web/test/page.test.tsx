import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "../app/page";

describe("HomePage", () => {
  it("renders the Traveller wordmark", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "Traveller" }),
    ).toBeInTheDocument();
  });
});
