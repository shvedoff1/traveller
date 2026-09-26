import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type MeResponse, type Visit } from "@traveller/shared";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "../app/page";
import {
  LAYER_FILL,
  LAYER_VISITED,
  buildVisitedFilter,
} from "../lib/map/map-style";
import { useMapStore } from "../lib/stores/map-store";
import { useToastStore } from "../lib/stores/toast-store";
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

/** Flip the map into edit mode (click toggles visited). */
function enterEditMode() {
  fireEvent.click(screen.getByTestId("map-mode-edit"));
  expect(useMapStore.getState().mode).toBe("edit");
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
    localStorage.clear();
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

  it("shows logged-out visitors the country card with a login CTA", async () => {
    mockServer(false);
    renderHome();
    await waitForAuthSettled();

    // No mode switch without an account — the map is look-only.
    expect(screen.queryByTestId("map-mode-toggle")).not.toBeInTheDocument();
    clickCountry(lastMap(), "FR");
    const sheet = await screen.findByTestId("country-detail-sheet");
    expect(sheet).toHaveTextContent("France");
    expect(sheet).toHaveTextContent("Log in to mark it as visited");
    expect(mocked.upsertVisit).not.toHaveBeenCalled();
  });

  it("view mode (default): a map click only shows the country", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();
    await waitFor(() =>
      expect(queryClient.getQueryState(["visits", "me"])?.status).toBe(
        "success",
      ),
    );

    expect(await screen.findByTestId("map-mode-toggle")).toHaveAttribute(
      "data-mode",
      "view",
    );
    expect(screen.queryByTestId("edit-mode-frame")).not.toBeInTheDocument();
    clickCountry(lastMap(), "FR");
    expect(await screen.findByTestId("country-detail-sheet")).toHaveTextContent(
      "France",
    );
    expect(useMapStore.getState().selected).toBe("FR");
    expect(mocked.upsertVisit).not.toHaveBeenCalled();
    expect(mocked.deleteVisit).not.toHaveBeenCalled();

    // Marking is an explicit button in the card.
    fireEvent.click(screen.getByTestId("visit-save"));
    await waitFor(() =>
      expect(mocked.upsertVisit).toHaveBeenCalledExactlyOnceWith("FR", {}),
    );
  });

  it("switches modes with the toggle and the E key, and remembers it", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();
    await screen.findByTestId("map-mode-toggle");

    enterEditMode();
    expect(screen.getByTestId("edit-mode-frame")).toBeInTheDocument();
    expect(localStorage.getItem("traveller:map-mode")).toBe("edit");

    fireEvent.keyDown(window, { key: "e" });
    expect(useMapStore.getState().mode).toBe("view");
    expect(localStorage.getItem("traveller:map-mode")).toBe("view");

    // Typing an "e" in the search box is not a mode switch.
    fireEvent.keyDown(screen.getByTestId("country-search"), { key: "e" });
    expect(useMapStore.getState().mode).toBe("view");
  });

  it("restores a saved edit mode on load", async () => {
    localStorage.setItem("traveller:map-mode", "edit");
    mockServer(true);
    renderHome();
    await waitForAuthSettled();
    await waitFor(() =>
      expect(screen.getByTestId("map-mode-toggle")).toHaveAttribute(
        "data-mode",
        "edit",
      ),
    );
  });

  it("edit mode: a map click toggles a country optimistically", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();
    await waitFor(() =>
      expect(queryClient.getQueryState(["visits", "me"])?.status).toBe(
        "success",
      ),
    );
    enterEditMode();

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
    expect(screen.getByTestId("list-filter-visited")).toHaveTextContent(
      "Visited 1",
    );
    expect(screen.getByTestId("country-toggle-FR")).toHaveAttribute(
      "aria-checked",
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
    enterEditMode();

    const map = lastMap();
    clickCountry(map, "FR");
    // Rolls back to empty once the PUT rejects.
    await waitFor(() =>
      expect(map.filters.get(LAYER_VISITED)).toEqual(buildVisitedFilter([])),
    );
    expect(screen.getByTestId("stats-count")).toHaveTextContent("0");
  });

  it("groups all countries by continent with visited/total, foldable", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();
    await waitFor(() =>
      expect(queryClient.getQueryState(["visits", "me"])?.status).toBe(
        "success",
      ),
    );
    fireEvent.click(screen.getByTestId("country-toggle-FR"));
    await waitFor(() =>
      expect(screen.getByTestId("list-filter-visited")).toHaveTextContent(
        "Visited 1",
      ),
    );

    // Every continent has a section, in canonical order.
    const headings = screen.getAllByTestId(/^region-heading-/);
    expect(headings.map((heading) => heading.textContent)).toEqual([
      expect.stringMatching(/^Africa/),
      expect.stringMatching(/^Antarctica/),
      expect.stringMatching(/^Asia/),
      expect.stringMatching(/^Europe/),
      expect.stringMatching(/^North America/),
      expect.stringMatching(/^Oceania/),
      expect.stringMatching(/^South America/),
    ]);
    // France counts towards Europe's visited/total.
    const europe = screen.getByTestId("region-heading-europe");
    expect(europe).toHaveTextContent(/1\/\d+/);
    expect(screen.getByTestId("region-heading-asia")).toHaveTextContent(
      /0\/\d+/,
    );
    expect(
      within(screen.getByTestId("region-europe")).getByTestId("country-row-FR"),
    ).toBeInTheDocument();

    // Folding a region hides its rows; the heading keeps the count.
    fireEvent.click(europe);
    expect(europe).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("country-row-FR")).not.toBeInTheDocument();
    expect(europe).toHaveTextContent(/1\/\d+/);

    // A search shows matches even inside a folded region.
    fireEvent.change(screen.getByTestId("country-search"), {
      target: { value: "franc" },
    });
    expect(screen.getByTestId("country-row-FR")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^region-heading-/)).toHaveLength(1);
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

    // The row opens the country (select + fly) without marking it…
    fireEvent.click(rows[0]!);
    const map = lastMap();
    await waitFor(() => expect(map.flyToCalls).toHaveLength(1));
    expect(map.flyToCalls[0]?.zoom).toBeGreaterThan(1);
    expect(useMapStore.getState().selected).toBe("NZ");
    expect(screen.getByTestId("country-row-NZ")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(mocked.upsertVisit).not.toHaveBeenCalled();

    // …marking is the checkbox.
    fireEvent.click(screen.getByTestId("country-toggle-NZ"));
    await waitFor(() =>
      expect(mocked.upsertVisit).toHaveBeenCalledExactlyOnceWith("NZ", {}),
    );
  });

  it("filters by visited status and undoes an unmark with its details", async () => {
    mockServer(true);
    serverVisits = [
      {
        countryCode: "FR",
        visitedYear: 2019,
        note: "Croissants",
        createdAt: new Date().toISOString(),
      },
    ];
    renderHome();
    await waitForAuthSettled();
    await waitFor(() =>
      expect(screen.getByTestId("country-toggle-FR")).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    // The year shows next to a visited country.
    expect(screen.getByTestId("country-row-FR")).toHaveTextContent("2019");

    fireEvent.click(screen.getByTestId("list-filter-visited"));
    expect(screen.getAllByTestId(/^country-row-/)).toHaveLength(1);
    expect(screen.getAllByTestId(/^region-heading-/)).toHaveLength(1);

    fireEvent.click(screen.getByTestId("list-filter-unvisited"));
    expect(screen.queryByTestId("country-row-FR")).not.toBeInTheDocument();
    expect(screen.getByTestId("country-row-JP")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("list-filter-all"));
    fireEvent.click(screen.getByTestId("country-toggle-FR"));
    await waitFor(() =>
      expect(mocked.deleteVisit).toHaveBeenCalledExactlyOnceWith("FR"),
    );
    const toast = useToastStore
      .getState()
      .toasts.find((candidate) => candidate.message === "Removed France");
    expect(toast?.action?.label).toBe("Undo");

    act(() => toast!.action!.onClick());
    await waitFor(() =>
      expect(mocked.upsertVisit).toHaveBeenCalledExactlyOnceWith("FR", {
        visitedYear: 2019,
        note: "Croissants",
      }),
    );
  });

  it("folds and unfolds every region at once", async () => {
    mockServer(true);
    renderHome();
    await waitForAuthSettled();

    fireEvent.click(screen.getByTestId("fold-all"));
    expect(screen.queryAllByTestId(/^country-row-/)).toHaveLength(0);
    for (const heading of screen.getAllByTestId(/^region-heading-/)) {
      expect(heading).toHaveAttribute("aria-expanded", "false");
    }
    fireEvent.click(screen.getByTestId("fold-all"));
    expect(screen.getByTestId("country-row-FR")).toBeInTheDocument();
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

    // Mark France via its checkbox, then open it — the detail sheet shows.
    fireEvent.click(screen.getByTestId("country-toggle-FR"));
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
    enterEditMode();

    clickCountry(lastMap(), "XK");
    expect(useMapStore.getState().selected).toBeNull();
    expect(mocked.upsertVisit).not.toHaveBeenCalled();
  });
});
