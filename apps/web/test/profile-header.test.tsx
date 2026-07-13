import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileHeader } from "../components/profile/ProfileHeader";
import { api } from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  api: { getMe: vi.fn() },
}));

const getMe = vi.mocked(api.getMe);

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const writeText = vi.fn<(text: string) => Promise<void>>();

describe("ProfileHeader", () => {
  beforeEach(() => {
    getMe.mockResolvedValue(null);
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders name, handle and a follow login-CTA for logged-out visitors", async () => {
    renderWithQuery(
      <ProfileHeader username="john" displayName="John Carter" avatarUrl={null} />,
    );
    expect(screen.getByTestId("profile-name")).toHaveTextContent("John Carter");
    expect(screen.getByTestId("profile-username")).toHaveTextContent("@john");
    // Logged out: the follow button is a login CTA.
    await waitFor(() =>
      expect(screen.getByTestId("follow-button")).toHaveAttribute(
        "href",
        "/login",
      ),
    );
    expect(screen.queryByTestId("edit-map-link")).not.toBeInTheDocument();
  });

  it("copies the page URL and shows a toast on share", async () => {
    renderWithQuery(
      <ProfileHeader username="john" displayName="John Carter" avatarUrl={null} />,
    );
    expect(screen.queryByTestId("share-toast")).not.toBeInTheDocument();

    screen.getByTestId("share-button").click();

    await waitFor(() =>
      expect(screen.getByTestId("share-toast")).toBeInTheDocument(),
    );
    expect(writeText).toHaveBeenCalledExactlyOnceWith(window.location.href);
  });

  it("shows the edit-your-map link to the profile owner", async () => {
    getMe.mockResolvedValue({
      id: "6d2f9c6e-2f9b-4f6c-9a4e-27a2f9adf001",
      username: "john",
      displayName: "John Carter",
      email: "john@example.com",
      avatarUrl: null,
      isPublic: true,
    });
    renderWithQuery(
      <ProfileHeader username="john" displayName="John Carter" avatarUrl={null} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("edit-map-link")).toHaveAttribute("href", "/"),
    );
    expect(screen.queryByTestId("follow-button")).not.toBeInTheDocument();
  });
});
