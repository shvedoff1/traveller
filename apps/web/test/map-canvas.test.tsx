import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapCanvas } from "../components/map/MapCanvas";
import {
  buildMapStyle,
  buildSelectedFilter,
  buildVisitedFilter,
  LAYER_FILL,
  LAYER_FRIEND,
  LAYER_OVERLAP,
  LAYER_SELECTED,
  LAYER_VISITED,
} from "../lib/map/map-style";
import { useThemeStore } from "../lib/stores/theme-store";
import { MockMap } from "./mocks/maplibre-gl";

vi.mock("maplibre-gl", () => import("./mocks/maplibre-gl"));

function lastMap(): MockMap {
  const map = MockMap.instances.at(-1);
  if (!map) throw new Error("no MockMap constructed");
  return map;
}

describe("MapCanvas", () => {
  beforeEach(() => {
    MockMap.instances = [];
    useThemeStore.setState({ theme: "dark" });
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    useThemeStore.setState({ theme: "dark" });
  });

  it("mounts a single map on its container and removes it on unmount", () => {
    const { unmount } = render(<MapCanvas visited={[]} selected={null} />);
    expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
    expect(MockMap.instances).toHaveLength(1);

    const map = lastMap();
    expect(map.options.container).toBe(screen.getByTestId("map-canvas"));
    expect(map.removed).toBe(false);

    unmount();
    expect(map.removed).toBe(true);
  });

  it("applies visited and selected filters on load and when props change", () => {
    const { rerender } = render(
      <MapCanvas visited={["FR"]} selected={null} />,
    );
    const map = lastMap();
    expect(map.filters.get(LAYER_VISITED)).toEqual(buildVisitedFilter(["FR"]));
    expect(map.filters.get(LAYER_SELECTED)).toEqual(buildSelectedFilter(null));

    rerender(<MapCanvas visited={["FR", "JP"]} selected="JP" />);
    expect(map.filters.get(LAYER_VISITED)).toEqual(
      buildVisitedFilter(["FR", "JP"]),
    );
    expect(map.filters.get(LAYER_SELECTED)).toEqual(buildSelectedFilter("JP"));
  });

  it("partitions the fills across visited/friend/overlap in compare mode", () => {
    const { rerender } = render(
      <MapCanvas visited={["FR", "BR"]} selected={null} />,
    );
    const map = lastMap();
    // No compare: my full map, compare layers empty.
    expect(map.filters.get(LAYER_VISITED)).toEqual(
      buildVisitedFilter(["FR", "BR"]),
    );
    expect(map.filters.get(LAYER_FRIEND)).toEqual(buildVisitedFilter([]));
    expect(map.filters.get(LAYER_OVERLAP)).toEqual(buildVisitedFilter([]));

    rerender(
      <MapCanvas
        visited={["FR", "BR"]}
        friendVisited={["BR", "AR"]}
        selected={null}
      />,
    );
    expect(map.filters.get(LAYER_VISITED)).toEqual(buildVisitedFilter(["FR"]));
    expect(map.filters.get(LAYER_FRIEND)).toEqual(buildVisitedFilter(["AR"]));
    expect(map.filters.get(LAYER_OVERLAP)).toEqual(buildVisitedFilter(["BR"]));

    // Leaving compare mode restores the plain visited fill.
    rerender(
      <MapCanvas visited={["FR", "BR"]} friendVisited={null} selected={null} />,
    );
    expect(map.filters.get(LAYER_VISITED)).toEqual(
      buildVisitedFilter(["FR", "BR"]),
    );
    expect(map.filters.get(LAYER_FRIEND)).toEqual(buildVisitedFilter([]));
    expect(map.filters.get(LAYER_OVERLAP)).toEqual(buildVisitedFilter([]));
  });

  it("swaps the style palette when the theme changes, keeping filters", () => {
    render(<MapCanvas visited={["FR"]} selected="FR" />);
    const map = lastMap();
    expect(map.options.style).toEqual(buildMapStyle("dark"));
    expect(map.setStyleCalls).toEqual([]);

    act(() => useThemeStore.getState().setTheme("light"));
    expect(map.setStyleCalls).toEqual([buildMapStyle("light")]);
    expect(map.filters.get(LAYER_VISITED)).toEqual(buildVisitedFilter(["FR"]));
    expect(map.filters.get(LAYER_SELECTED)).toEqual(buildSelectedFilter("FR"));

    act(() => useThemeStore.getState().setTheme("dark"));
    expect(map.setStyleCalls).toEqual([
      buildMapStyle("light"),
      buildMapStyle("dark"),
    ]);
  });

  it("reports clicks on countries", () => {
    const onCountryClick = vi.fn();
    render(
      <MapCanvas visited={[]} selected={null} onCountryClick={onCountryClick} />,
    );

    lastMap().fire(
      "click",
      { features: [{ id: "BR", properties: { iso: "BR" } }] },
      LAYER_FILL,
    );
    expect(onCountryClick).toHaveBeenCalledExactlyOnceWith("BR");

    // Clicks that resolve no feature are ignored.
    lastMap().fire("click", { features: [] }, LAYER_FILL);
    expect(onCountryClick).toHaveBeenCalledTimes(1);
  });

  it("mirrors external highlight onto the hover feature-state", () => {
    const { rerender } = render(
      <MapCanvas visited={[]} selected={null} highlighted={null} />,
    );
    const map = lastMap();
    expect(map.featureStateCalls).toEqual([]);

    rerender(<MapCanvas visited={[]} selected={null} highlighted="FR" />);
    expect(map.featureStateCalls).toEqual([{ method: "set", id: "FR" }]);

    rerender(<MapCanvas visited={[]} selected={null} highlighted="DE" />);
    expect(map.featureStateCalls).toEqual([
      { method: "set", id: "FR" },
      { method: "remove", id: "FR" },
      { method: "set", id: "DE" },
    ]);

    rerender(<MapCanvas visited={[]} selected={null} highlighted={null} />);
    expect(map.featureStateCalls).toEqual([
      { method: "set", id: "FR" },
      { method: "remove", id: "FR" },
      { method: "set", id: "DE" },
      { method: "remove", id: "DE" },
    ]);
  });

  it("executes flyTo requests and re-triggers on new request ids", () => {
    const { rerender } = render(
      <MapCanvas visited={[]} selected={null} flyTo={null} />,
    );
    const map = lastMap();
    expect(map.flyToCalls).toEqual([]);

    const request = { center: [2.46, 46.61] as [number, number], zoom: 3.6 };
    rerender(
      <MapCanvas visited={[]} selected={null} flyTo={{ ...request, id: 1 }} />,
    );
    expect(map.flyToCalls).toEqual([
      { center: request.center, zoom: request.zoom, essential: true },
    ]);

    rerender(
      <MapCanvas visited={[]} selected={null} flyTo={{ ...request, id: 2 }} />,
    );
    expect(map.flyToCalls).toHaveLength(2);
  });

  it("tracks hover via feature-state and pointer cursor", () => {
    const onCountryHover = vi.fn();
    render(
      <MapCanvas visited={[]} selected={null} onCountryHover={onCountryHover} />,
    );
    const map = lastMap();

    act(() =>
      map.fire(
        "mousemove",
        { features: [{ id: "FR", properties: { iso: "FR" } }] },
        LAYER_FILL,
      ),
    );
    expect(onCountryHover).toHaveBeenLastCalledWith("FR");
    expect(map.featureStateCalls).toEqual([{ method: "set", id: "FR" }]);
    expect(map.getCanvas().style.cursor).toBe("pointer");

    act(() =>
      map.fire(
        "mousemove",
        { features: [{ id: "DE", properties: { iso: "DE" } }] },
        LAYER_FILL,
      ),
    );
    expect(onCountryHover).toHaveBeenLastCalledWith("DE");
    expect(map.featureStateCalls).toEqual([
      { method: "set", id: "FR" },
      { method: "remove", id: "FR" },
      { method: "set", id: "DE" },
    ]);

    act(() => map.fire("mouseleave", undefined, LAYER_FILL));
    expect(onCountryHover).toHaveBeenLastCalledWith(null);
    expect(map.getCanvas().style.cursor).toBe("");
  });

  it("shows a country-name chip with flag on hover, clearing on leave", () => {
    render(<MapCanvas visited={[]} selected={null} />);
    const map = lastMap();
    expect(screen.queryByTestId("map-tooltip")).not.toBeInTheDocument();

    act(() =>
      map.fire(
        "mousemove",
        {
          features: [{ id: "FR", properties: { iso: "FR", name: "France" } }],
          point: { x: 120, y: 80 },
        },
        LAYER_FILL,
      ),
    );
    const chip = screen.getByTestId("map-tooltip");
    expect(chip).toHaveTextContent("France");
    // Flag emoji derived from the code is present.
    expect(chip.textContent).toContain("🇫🇷");

    // Falls back to the feature name for codes outside the canonical list.
    act(() =>
      map.fire(
        "mousemove",
        {
          features: [{ id: "XK", properties: { iso: "XK", name: "Kosovo" } }],
          point: { x: 200, y: 200 },
        },
        LAYER_FILL,
      ),
    );
    expect(screen.getByTestId("map-tooltip")).toHaveTextContent("Kosovo");

    act(() => map.fire("mouseleave", undefined, LAYER_FILL));
    expect(screen.queryByTestId("map-tooltip")).not.toBeInTheDocument();
  });

  it("renders the projection toggle only when enabled and flips projection", () => {
    const { rerender } = render(<MapCanvas visited={[]} selected={null} />);
    expect(screen.queryByTestId("projection-toggle")).not.toBeInTheDocument();

    rerender(
      <MapCanvas visited={[]} selected={null} showProjectionToggle />,
    );
    const button = screen.getByTestId("projection-toggle");
    expect(button).toHaveAttribute("aria-label", "Switch to flat map");

    const map = lastMap();
    act(() => button.click());
    expect(map.setProjectionCalls).toEqual([{ type: "mercator" }]);
    expect(button).toHaveAttribute("aria-label", "Switch to globe view");
    expect(sessionStorage.getItem("traveller:map-projection")).toBe("mercator");

    act(() => button.click());
    expect(map.setProjectionCalls).toEqual([
      { type: "mercator" },
      { type: "globe" },
    ]);
    expect(sessionStorage.getItem("traveller:map-projection")).toBe("globe");
  });

  it("restores a persisted flat projection on mount", () => {
    sessionStorage.setItem("traveller:map-projection", "mercator");
    render(<MapCanvas visited={[]} selected={null} showProjectionToggle />);
    const map = lastMap();
    expect(map.setProjectionCalls).toEqual([{ type: "mercator" }]);
    expect(screen.getByTestId("projection-toggle")).toHaveAttribute(
      "aria-label",
      "Switch to globe view",
    );
  });

  it("readonly: ignores clicks and skips the pointer cursor, keeps hover", () => {
    const onCountryClick = vi.fn();
    const onCountryHover = vi.fn();
    render(
      <MapCanvas
        visited={["FR"]}
        selected={null}
        readonly
        onCountryClick={onCountryClick}
        onCountryHover={onCountryHover}
      />,
    );
    const map = lastMap();

    // Hover still highlights via feature-state, but no pointer cursor.
    act(() =>
      map.fire(
        "mousemove",
        { features: [{ id: "FR", properties: { iso: "FR" } }] },
        LAYER_FILL,
      ),
    );
    expect(onCountryHover).toHaveBeenLastCalledWith("FR");
    expect(map.featureStateCalls).toEqual([{ method: "set", id: "FR" }]);
    expect(map.getCanvas().style.cursor).toBe("");

    // Clicks never reach the handler.
    map.fire(
      "click",
      { features: [{ id: "FR", properties: { iso: "FR" } }] },
      LAYER_FILL,
    );
    expect(onCountryClick).not.toHaveBeenCalled();

    // Visited filter still applied.
    expect(map.filters.get(LAYER_VISITED)).toEqual(buildVisitedFilter(["FR"]));
  });
});
