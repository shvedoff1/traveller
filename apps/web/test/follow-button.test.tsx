import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FollowButton } from "../components/social/FollowButton";
import { api } from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  api: {
    getMe: vi.fn(),
    getProfile: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

const getMe = vi.mocked(api.getMe);
const followUser = vi.mocked(api.followUser);
const unfollowUser = vi.mocked(api.unfollowUser);

const me = {
  id: "6d2f9c6e-2f9b-4f6c-9a4e-27a2f9adf001",
  username: "john",
  displayName: "John Carter",
  email: "john@example.com",
  avatarUrl: null,
  isPublic: true,
};

const maria = {
  username: "maria",
  displayName: "Maria Silva",
  avatarUrl: null,
  countryCount: 4,
};

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}

describe("FollowButton", () => {
  beforeEach(() => {
    getMe.mockResolvedValue(me);
    followUser.mockResolvedValue(undefined);
    unfollowUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("links to /login when logged out", async () => {
    getMe.mockResolvedValue(null);
    renderWithQuery(<FollowButton user={maria} isFollowing={false} />);
    await waitFor(() =>
      expect(screen.getByTestId("follow-button")).toHaveAttribute(
        "href",
        "/login",
      ),
    );
  });

  it("is hidden on your own profile", async () => {
    getMe.mockResolvedValue({ ...me, username: "maria" });
    renderWithQuery(<FollowButton user={maria} isFollowing={false} />);
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    expect(screen.queryByTestId("follow-button")).not.toBeInTheDocument();
  });

  it("follows optimistically: label flips before the request settles", async () => {
    let resolveFollow!: () => void;
    followUser.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveFollow = resolve;
      }),
    );
    renderWithQuery(<FollowButton user={maria} isFollowing={false} />);

    const button = await screen.findByTestId("follow-button");
    expect(button).toHaveTextContent("Follow");
    button.click();

    // isFollowing comes from the parent's (mutation-updated) caches here,
    // but aria-pressed and the API call show the optimistic path fired.
    await waitFor(() =>
      expect(followUser).toHaveBeenCalledExactlyOnceWith("maria"),
    );
    resolveFollow();
  });

  it("resolves follow state from the profile query when not provided", async () => {
    const mariaProfile = {
      username: "maria",
      displayName: "Maria Silva",
      avatarUrl: null,
      countryCodes: ["BR"],
      counts: { countries: 1, followers: 1, following: 0 },
    };
    // Initially followed; the post-mutation refetch sees the unfollow.
    vi.mocked(api.getProfile)
      .mockResolvedValueOnce({ ...mariaProfile, isFollowing: true })
      .mockResolvedValue({
        ...mariaProfile,
        counts: { ...mariaProfile.counts, followers: 0 },
        isFollowing: false,
      });
    renderWithQuery(<FollowButton user={maria} />);

    const button = await screen.findByTestId("follow-button");
    await waitFor(() => expect(button).toHaveTextContent("Following"));

    button.click();
    await waitFor(() =>
      expect(unfollowUser).toHaveBeenCalledExactlyOnceWith("maria"),
    );
    // The optimistic profile-cache update flips the label immediately.
    expect(button).toHaveTextContent("Follow");
  });

  it("rolls the profile cache back when the request fails", async () => {
    vi.mocked(api.getProfile).mockResolvedValue({
      username: "maria",
      displayName: "Maria Silva",
      avatarUrl: null,
      countryCodes: ["BR"],
      counts: { countries: 1, followers: 0, following: 0 },
      isFollowing: false,
    });
    let rejectFollow!: (error: Error) => void;
    followUser.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectFollow = reject;
      }),
    );
    renderWithQuery(<FollowButton user={maria} />);

    const button = await screen.findByTestId("follow-button");
    await waitFor(() => expect(button).toHaveTextContent("Follow"));

    button.click();
    // Optimistic flip while the request is in flight …
    await waitFor(() => expect(button).toHaveTextContent("Following"));
    // … then the error rolls it back.
    rejectFollow(new Error("boom"));
    await waitFor(() => expect(button).toHaveTextContent("Follow"));
  });
});
