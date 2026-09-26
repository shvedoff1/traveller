import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type GroupDetail,
  type GroupInvitePreview,
  type MeResponse,
} from "@traveller/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GroupScreen } from "../components/groups/GroupScreen";
import { GroupsScreen } from "../components/groups/GroupsScreen";
import { JoinGroupScreen } from "../components/groups/JoinGroupScreen";
import { ApiError, api } from "../lib/api-client";
import {
  LAYER_OVERLAP,
  LAYER_VISITED,
  buildVisitedFilter,
} from "../lib/map/map-style";
import { MockMap } from "./mocks/maplibre-gl";

vi.mock("maplibre-gl", () => import("./mocks/maplibre-gl"));
vi.mock("../lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  api: {
    getMe: vi.fn(),
    getMyGroups: vi.fn(),
    createGroup: vi.fn(),
    getGroup: vi.fn(),
    renameGroup: vi.fn(),
    deleteGroup: vi.fn(),
    rotateGroupInvite: vi.fn(),
    addGroupMember: vi.fn(),
    removeGroupMember: vi.fn(),
    getGroupInvite: vi.fn(),
    joinGroup: vi.fn(),
    getFollowing: vi.fn(),
  },
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

const mocked = vi.mocked(api);

const ME: MeResponse = {
  id: "00000000-0000-4000-8000-000000000001",
  username: "ann",
  displayName: "Ann",
  email: "ann@example.com",
  avatarUrl: null,
  isPublic: true,
};

const GROUP_ID = "00000000-0000-4000-8000-0000000000aa";

function detail(overrides: Partial<GroupDetail> = {}): GroupDetail {
  return {
    id: GROUP_ID,
    name: "Crew",
    createdAt: "2026-09-26T10:00:00.000Z",
    isOwner: true,
    inviteCode: "abcdefghijkl",
    members: [
      {
        username: "ann",
        displayName: "Ann",
        avatarUrl: null,
        isOwner: true,
        countryCount: 3,
        uniqueCount: 1,
        countryCodes: ["FR", "IT", "JP"],
      },
      {
        username: "bob",
        displayName: "Bob",
        avatarUrl: null,
        isOwner: false,
        countryCount: 2,
        uniqueCount: 1,
        countryCodes: ["BR", "FR"],
      },
    ],
    stats: {
      countryCount: 4,
      worldPercent: 1.6,
      averageCount: 2.5,
      continents: {
        Europe: { visited: 2, total: 51 },
        Asia: { visited: 1, total: 50 },
      },
      countryCodes: ["BR", "FR", "IT", "JP"],
      sharedCodes: ["FR"],
      popular: [{ code: "FR", count: 2 }],
    },
    ...overrides,
  };
}

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  MockMap.instances = [];
  mocked.getMe.mockResolvedValue(ME);
  mocked.getFollowing.mockResolvedValue([]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("GroupsScreen", () => {
  it("asks logged-out visitors to log in", async () => {
    mocked.getMe.mockResolvedValue(null);
    renderWithQuery(<GroupsScreen />);
    expect(await screen.findByTestId("groups-login-cta")).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("sends users without a handle to pick one", async () => {
    mocked.getMe.mockResolvedValue({ ...ME, username: null });
    renderWithQuery(<GroupsScreen />);
    expect(await screen.findByTestId("groups-login-cta")).toHaveAttribute(
      "href",
      "/welcome",
    );
  });

  it("lists my groups and creates a new one", async () => {
    mocked.getMyGroups.mockResolvedValue([
      {
        id: GROUP_ID,
        name: "Crew",
        memberCount: 2,
        countryCount: 4,
        isOwner: true,
      },
    ]);
    mocked.createGroup.mockResolvedValue(
      detail({ id: "00000000-0000-4000-8000-0000000000bb", name: "New" }),
    );
    renderWithQuery(<GroupsScreen />);

    const card = await screen.findByTestId(`group-card-${GROUP_ID}`);
    expect(card).toHaveAttribute("href", `/groups/${GROUP_ID}`);
    expect(card).toHaveTextContent("Crew");
    expect(card).toHaveTextContent("2 members · you run it");
    expect(card).toHaveTextContent("4");

    expect(screen.getByTestId("group-create")).toBeDisabled();
    fireEvent.change(screen.getByTestId("group-name-input"), {
      target: { value: "  New  " },
    });
    fireEvent.click(screen.getByTestId("group-create"));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/groups/00000000-0000-4000-8000-0000000000bb",
      ),
    );
    expect(mocked.createGroup).toHaveBeenCalledWith("New");
  });

  it("shows an empty state", async () => {
    mocked.getMyGroups.mockResolvedValue([]);
    renderWithQuery(<GroupsScreen />);
    expect(await screen.findByTestId("groups-empty")).toBeInTheDocument();
  });
});

describe("GroupScreen", () => {
  it("renders headline stats, leaderboard and what the group shares", async () => {
    mocked.getGroup.mockResolvedValue(detail());
    renderWithQuery(<GroupScreen id={GROUP_ID} />);

    expect(await screen.findByTestId("group-name")).toHaveTextContent("Crew");
    expect(screen.getByTestId("group-stat-countries")).toHaveTextContent("4");
    expect(screen.getByTestId("group-stat-percent")).toHaveTextContent("1.6%");
    expect(screen.getByTestId("group-stat-shared")).toHaveTextContent("1");
    expect(screen.getByTestId("group-stat-average")).toHaveTextContent("2.5");

    const rows = within(screen.getByTestId("group-leaderboard")).getAllByRole(
      "listitem",
    );
    expect(rows.map((row) => row.dataset.testid)).toEqual([
      "group-member-ann",
      "group-member-bob",
    ]);
    expect(rows[0]).toHaveTextContent("(you)");
    expect(rows[0]).toHaveTextContent("owner");
    expect(rows[1]).toHaveTextContent("1 only them");

    expect(screen.getByTestId("group-shared")).toHaveTextContent("France");
    expect(screen.getByTestId("group-popular")).toHaveTextContent("2/2");
    expect(screen.getByTestId("group-continents")).toHaveTextContent("2/51");
    expect(screen.getByTestId("group-invite-link")).toHaveValue(
      `${window.location.origin}/join/abcdefghijkl`,
    );
  });

  it("draws the group's map and lights up a focused member", async () => {
    mocked.getGroup.mockResolvedValue(detail());
    renderWithQuery(<GroupScreen id={GROUP_ID} />);
    await screen.findByTestId("group-name");

    const map = MockMap.instances.at(-1)!;
    // Union in the base colour, "everyone's been" in the highlight.
    expect(map.filters.get(LAYER_OVERLAP)).toEqual(buildVisitedFilter(["FR"]));
    expect(map.filters.get(LAYER_VISITED)).toEqual(
      buildVisitedFilter(["BR", "IT", "JP"]),
    );
    expect(screen.getByTestId("group-map-legend")).toHaveTextContent(
      "Everyone",
    );

    fireEvent.click(screen.getByTestId("group-member-focus-bob"));
    expect(screen.getByTestId("group-member-focus-bob")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(map.filters.get(LAYER_OVERLAP)).toEqual(
      buildVisitedFilter(["BR", "FR"]),
    );
    expect(screen.getByTestId("group-map-legend")).toHaveTextContent("Bob");

    fireEvent.click(screen.getByTestId("group-map-unfocus"));
    expect(map.filters.get(LAYER_OVERLAP)).toEqual(buildVisitedFilter(["FR"]));
  });

  it("owner renames, removes a member, adds someone they follow, deletes", async () => {
    mocked.getGroup.mockResolvedValue(detail());
    mocked.renameGroup.mockResolvedValue(detail({ name: "Renamed" }));
    mocked.removeGroupMember.mockResolvedValue(undefined);
    mocked.deleteGroup.mockResolvedValue(undefined);
    mocked.getFollowing.mockResolvedValue([
      { username: "bob", displayName: "Bob", avatarUrl: null, countryCount: 2 },
      { username: "cat", displayName: "Cat", avatarUrl: null, countryCount: 1 },
    ]);
    mocked.addGroupMember.mockResolvedValue(detail());
    renderWithQuery(<GroupScreen id={GROUP_ID} />);
    await screen.findByTestId("group-name");

    fireEvent.click(screen.getByTestId("group-rename"));
    fireEvent.change(screen.getByTestId("group-rename-input"), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByTestId("group-rename-save"));
    await waitFor(() =>
      expect(screen.getByTestId("group-name")).toHaveTextContent("Renamed"),
    );
    expect(mocked.renameGroup).toHaveBeenCalledWith(GROUP_ID, "Renamed");

    // Only people not already in the group are offered.
    await screen.findByTestId("group-add-cat");
    expect(screen.queryByTestId("group-add-bob")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("group-add-cat"));
    await waitFor(() =>
      expect(mocked.addGroupMember).toHaveBeenCalledWith(GROUP_ID, "cat"),
    );

    // The owner can't be removed; others can.
    expect(
      screen.queryByTestId("group-member-remove-ann"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("group-member-remove-bob"));
    await waitFor(() =>
      expect(mocked.removeGroupMember).toHaveBeenCalledWith(GROUP_ID, "bob"),
    );

    fireEvent.click(screen.getByTestId("group-delete"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/groups"));
    expect(mocked.deleteGroup).toHaveBeenCalledWith(GROUP_ID);
  });

  it("members can leave but not manage", async () => {
    mocked.getGroup.mockResolvedValue(detail({ isOwner: false }));
    mocked.getMe.mockResolvedValue({ ...ME, username: "bob" });
    mocked.removeGroupMember.mockResolvedValue(undefined);
    renderWithQuery(<GroupScreen id={GROUP_ID} />);
    await screen.findByTestId("group-name");

    expect(screen.queryByTestId("group-rename")).not.toBeInTheDocument();
    expect(screen.queryByTestId("group-delete")).not.toBeInTheDocument();
    expect(screen.queryByTestId("group-invite-rotate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("group-add-following")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("group-member-remove-ann"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("group-leave"));
    await waitFor(() =>
      expect(mocked.removeGroupMember).toHaveBeenCalledWith(GROUP_ID, "bob"),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/groups"));
  });

  it("shows a not-found card for a group you're not in", async () => {
    mocked.getGroup.mockRejectedValue(new ApiError(404));
    renderWithQuery(<GroupScreen id={GROUP_ID} />);
    expect(await screen.findByTestId("group-missing")).toHaveTextContent(
      "Group not found",
    );
  });

  it("a one-person group invites instead of comparing", async () => {
    const solo = detail();
    solo.members = solo.members.slice(0, 1);
    solo.stats = { ...solo.stats, sharedCodes: [], popular: [] };
    mocked.getGroup.mockResolvedValue(solo);
    renderWithQuery(<GroupScreen id={GROUP_ID} />);
    await screen.findByTestId("group-name");
    expect(screen.getByTestId("group-stat-shared")).toHaveTextContent("—");
    expect(screen.getByTestId("group-shared")).toHaveTextContent(
      "Invite someone",
    );
    expect(screen.queryByTestId("group-popular")).not.toBeInTheDocument();
  });
});

describe("JoinGroupScreen", () => {
  const preview: GroupInvitePreview = {
    id: GROUP_ID,
    name: "Crew",
    memberCount: 2,
    ownerDisplayName: "Ann",
    isMember: false,
  };

  it("joins and opens the group", async () => {
    mocked.getGroupInvite.mockResolvedValue(preview);
    mocked.joinGroup.mockResolvedValue({ id: GROUP_ID });
    renderWithQuery(<JoinGroupScreen code="abcdefghijkl" />);

    const card = await screen.findByTestId("invite-card");
    expect(card).toHaveTextContent("Ann invites you to");
    expect(card).toHaveTextContent("Crew");
    expect(card).toHaveTextContent("2 members");

    fireEvent.click(screen.getByTestId("invite-join"));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/groups/${GROUP_ID}`),
    );
    expect(mocked.joinGroup).toHaveBeenCalledWith("abcdefghijkl");
  });

  it("links existing members straight to the group", async () => {
    mocked.getGroupInvite.mockResolvedValue({ ...preview, isMember: true });
    renderWithQuery(<JoinGroupScreen code="abcdefghijkl" />);
    expect(await screen.findByTestId("invite-open")).toHaveAttribute(
      "href",
      `/groups/${GROUP_ID}`,
    );
  });

  it("explains a dead invite", async () => {
    mocked.getGroupInvite.mockRejectedValue(new ApiError(404));
    renderWithQuery(<JoinGroupScreen code="zzzzzzzzzzzz" />);
    expect(await screen.findByTestId("invite-missing")).toHaveTextContent(
      "doesn’t work",
    );
  });
});
