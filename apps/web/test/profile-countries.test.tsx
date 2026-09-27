import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type MeResponse, type Visit } from "@traveller/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileMap } from "../components/profile/ProfileMap";
import { api } from "../lib/api-client";
import { LAYER_SELECTED, buildSelectedFilter } from "../lib/map/map-style";
import { computeStats } from "../lib/stats";
import { MockMap } from "./mocks/maplibre-gl";

vi.mock("maplibre-gl", () => import("./mocks/maplibre-gl"));
vi.mock("../lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  api: { getMe: vi.fn(), getMyVisits: vi.fn() },
}));

const mocked = vi.mocked(api);

const me = (username: string): MeResponse => ({
  id: "00000000-0000-4000-8000-000000000001",
  username,
  displayName: username,
  email: `${username}@example.com`,
  avatarUrl: null,
  isPublic: true,
});

const visit = (countryCode: string): Visit => ({
  countryCode,
  visitedYear: null,
  note: null,
  createdAt: "2026-09-26T10:00:00.000Z",
});

function renderProfile() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfileMap
        username="maria"
        countryCodes={["JP", "FR", "BR", "IT"]}
        stats={computeStats(["JP", "FR", "BR", "IT"])}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  MockMap.instances = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("profile country list", () => {
  it("opens from the stats card, grouped by continent, and flies to a pick", async () => {
    mocked.getMe.mockResolvedValue(null);
    renderProfile();

    expect(screen.queryByTestId("profile-countries")).not.toBeInTheDocument();
    // The stats card is the trigger (no second "Countries" button).
    expect(screen.getByTestId("stats-count")).toHaveTextContent("4");
    const button = screen.getByTestId("profile-countries-button");
    expect(button).toHaveAccessibleName("Show the country list");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    const panel = screen.getByTestId("profile-countries");
    const headings = within(panel)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Asia1", "Europe2", "South America1"]);
    // Logged out: no comparison filters.
    expect(screen.queryByTestId("profile-filter-shared")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("profile-country-FR"));
    const map = MockMap.instances.at(-1)!;
    await waitFor(() => expect(map.flyToCalls).toHaveLength(1));
    expect(map.flyToCalls[0]?.zoom).toBeGreaterThan(1);
    expect(map.filters.get(LAYER_SELECTED)).toEqual(buildSelectedFilter("FR"));
    expect(screen.getByTestId("profile-country-FR")).toHaveAttribute(
      "aria-current",
      "true",
    );

    fireEvent.click(screen.getByTestId("profile-countries-close"));
    expect(screen.queryByTestId("profile-countries")).not.toBeInTheDocument();

    // The card toggles too.
    fireEvent.click(button);
    expect(screen.getByTestId("profile-countries")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByTestId("profile-countries")).not.toBeInTheDocument();
  });

  it("lets a logged-in visitor see what they share and what's new to them", async () => {
    mocked.getMe.mockResolvedValue(me("ann"));
    mocked.getMyVisits.mockResolvedValue([visit("FR"), visit("DE")]);
    renderProfile();
    fireEvent.click(screen.getByTestId("profile-countries-button"));

    const shared = await screen.findByTestId("profile-filter-shared");
    await waitFor(() => expect(shared).toHaveTextContent("Both of you 1"));
    expect(screen.getByTestId("profile-filter-new")).toHaveTextContent(
      "Not yet yours 3",
    );

    fireEvent.click(shared);
    expect(screen.getByTestId("profile-country-FR")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-country-JP")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("profile-filter-new"));
    expect(screen.queryByTestId("profile-country-FR")).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-country-JP")).toBeInTheDocument();
  });

  it("doesn't compare you with yourself", async () => {
    mocked.getMe.mockResolvedValue(me("maria"));
    renderProfile();
    fireEvent.click(screen.getByTestId("profile-countries-button"));
    await waitFor(() => expect(mocked.getMe).toHaveBeenCalled());
    expect(screen.queryByTestId("profile-filter-shared")).not.toBeInTheDocument();
    expect(mocked.getMyVisits).not.toHaveBeenCalled();
  });
});
