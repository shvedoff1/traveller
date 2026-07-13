import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type MeResponse, type Visit } from "@traveller/shared";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "../app/page";
import {
  LAYER_FILL,
  LAYER_VISITED,
  buildVisitedFilter,
} from "../lib/map/map-style";
import { useMapStore } from "../lib/stores/map-store";
import { applyUpsert } from "../lib/visits/visits-cache";
import { api } from "../lib/api-client";
import { MockMap } from "./mocks/maplibre-gl";

vi.mock("maplibre-gl", () => import("./mocks/maplibre-gl"));
vi.mock("../lib/api-client", async (importOriginal) => ({
  // Keep ApiError & co for modules (lib/errors) that import them.
  ...(await importOriginal<Record<string, unknown>>()),
  api: {
    getMe: vi.fn(),
    getMyVisits: vi.fn(),
    upsertVisit: vi.fn(),
    deleteVisit: vi.fn(),
  },
}));

const mocked = vi.mocked(api);

const ME: MeResponse = {
  id: "00000000-0000-4000-8000-000000000001",
  username: "traveller",
  displayName: "Traveller",
  email: "traveller@example.com",
  avatarUrl: null,
  isPublic: true,
};

/** In-memory stand-in for the visits API, mirroring PUT/DELETE semantics. */
let serverVisits: Visit[] = [];

function mockServer(loggedIn: boolean) {
  serverVisits = [];
  mocked.getMe.mockImplementation(async () => (loggedIn ? ME : null));
  mocked.getMyVisits.mockImplementation(async () => [...serverVisits]);
  mocked.upsertVisit.mockImplementation(async (countryCode, input) => {
    serverVisits = applyUpsert(serverVisits, countryCode, input);
    return serverVisits.find((visit) => visit.countryCode === countryCode)!;
  });
  mocked.deleteVisit.mockImplementation(async (countryCode) => {
    serverVisits = serverVisits.filter(
      (visit) => visit.countryCode !== countryCode,
    );
  });
}

let queryClient: QueryClient;

function renderHome() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

async function waitForAuthSettled() {
  await waitFor(() =>
    expect(queryClient.getQueryState(["me"])?.status).toBe("success"),
  );
}

function lastMap(): MockMap {
  const map = MockMap.instances.at(-1);
  if (!map) throw new Error("no MockMap constructed");
  return map;
}

function clickCountry(map: MockMap, iso: string) {
  act(() => {
    map.fire(
      "click",
      { features: [{ id: iso, properties: { iso } }] },
      LAYER_FILL,
    );
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockMap.instances = [];
    useMapStore.setState(useMapStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the map, country panel and stats bar", async () => {
    mockServer(false);
    renderHome();
    expect(
      screen.getByRole("application", { name: "Interactive world map" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("country-panel")).toBeInTheDocument();
    expect(screen.getByTestId("stats-bar")).toBeInTheDocument();
    expect(screen.getByTestId("stats-count")).toHaveTextContent("0");
    await waitForAuthSettled();
  });

  it("prompts logged-out visitors to log in instead of mutating", async () => {
    mockServer(false);
    renderHome();
    await waitForAuthSettled();

    clickCountry(lastMap(), "FR");
    expect(await screen.findByTestId("login-prompt")).toBeInTheDocument();
    expect(mocked.upsertVisit).not.toHaveBeenCalled();
    // Selection still works: the detail sheet opens with a login CTA.
    expect(screen.getByTestId("country-detail-sheet")).toHaveTextContent(
      "France",
    );
  });

  it("toggles a country optimistically when logged in", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();
    await waitFor(() =>
      expect(queryClient.getQueryState(["visits", "me"])?.status).toBe(
        "success",
      ),
    );

    const map = lastMap();
    clickCountry(map, "FR");

    // Optimistic: map recolors and stats update before the PUT resolves.
    await waitFor(() =>
      expect(map.filters.get(LAYER_VISITED)).toEqual(
        buildVisitedFilter(["FR"]),
      ),
    );
    expect(mocked.upsertVisit).toHaveBeenCalledExactlyOnceWith("FR", {});
    await waitFor(() =>
      expect(screen.getByTestId("stats-count")).toHaveTextContent("1"),
    );
    expect(screen.getByTestId("visited-heading")).toHaveTextContent(
      "Visited (1)",
    );
    expect(screen.getByTestId("country-row-FR")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Second click unmarks.
    clickCountry(map, "FR");
    await waitFor(() =>
      expect(map.filters.get(LAYER_VISITED)).toEqual(buildVisitedFilter([])),
    );
    expect(mocked.deleteVisit).toHaveBeenCalledExactlyOnceWith("FR");
    await waitFor(() =>
      expect(screen.getByTestId("stats-count")).toHaveTextContent("0"),
    );
  });

  it("rolls the optimistic update back when the mutation fails", async () => {
    mockServer(true);
    mocked.upsertVisit.mockRejectedValue(new Error("boom"));
    renderHome();
    await waitForAuthSettled();
    await waitFor(() =>
      expect(queryClient.getQueryState(["visits", "me"])?.status).toBe(
        "success",
      ),
    );

    const map = lastMap();
    clickCountry(map, "FR");
    // Rolls back to empty once the PUT rejects.
    await waitFor(() =>
      expect(map.filters.get(LAYER_VISITED)).toEqual(buildVisitedFilter([])),
    );
    expect(screen.getByTestId("stats-count")).toHaveTextContent("0");
  });

  it("filters the list and flies to a picked country", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();

    fireEvent.change(screen.getByTestId("country-search"), {
      target: { value: "zeal" },
    });
    const rows = screen.getAllByTestId(/^country-row-/);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("New Zealand");

    fireEvent.click(rows[0]!);
    const map = lastMap();
    await waitFor(() => expect(map.flyToCalls).toHaveLength(1));
    expect(map.flyToCalls[0]?.zoom).toBeGreaterThan(1);
    expect(mocked.upsertVisit).toHaveBeenCalledExactlyOnceWith("NZ", {});
  });

  it("edits year/note through the detail sheet and re-displays them", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();
    await waitFor(() =>
      expect(queryClient.getQueryState(["visits", "me"])?.status).toBe(
        "success",
      ),
    );

    // Mark France via its row — the detail sheet opens.
    fireEvent.click(screen.getByTestId("country-row-FR"));
    const sheet = await screen.findByTestId("country-detail-sheet");
    expect(sheet).toHaveTextContent("France");

    // Save a year and note via the same PUT.
    fireEvent.change(screen.getByTestId("visit-year"), {
      target: { value: "2019" },
    });
    fireEvent.change(screen.getByTestId("visit-note"), {
      target: { value: "Croissants" },
    });
    fireEvent.click(screen.getByTestId("visit-save"));
    await waitFor(() =>
      expect(mocked.upsertVisit).toHaveBeenLastCalledWith("FR", {
        visitedYear: 2019,
        note: "Croissants",
      }),
    );

    // Clicking a visited row re-opens the sheet without unmarking…
    fireEvent.click(screen.getByTestId("country-row-FR"));
    expect(mocked.deleteVisit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId("visit-year")).toHaveValue("2019"),
    );
    expect(screen.getByTestId("visit-note")).toHaveValue("Croissants");

    // …and unmark lives in the sheet.
    fireEvent.click(screen.getByTestId("visit-unmark"));
    await waitFor(() =>
      expect(mocked.deleteVisit).toHaveBeenCalledExactlyOnceWith("FR"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("stats-count")).toHaveTextContent("0"),
    );
  });

  it("ignores clicks on geometries outside the canonical country list", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();

    clickCountry(lastMap(), "XK");
    expect(useMapStore.getState().selected).toBeNull();
    expect(mocked.upsertVisit).not.toHaveBeenCalled();
  });
});
