import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapCanvas } from "../components/map/MapCanvas";
import {
  buildSelectedFilter,
  buildVisitedFilter,
  LAYER_FILL,
  LAYER_SELECTED,
  LAYER_VISITED,
} from "../lib/map/map-style";
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
  });

  afterEach(() => {
    cleanup();
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

    map.fire(
      "mousemove",
      { features: [{ id: "FR", properties: { iso: "FR" } }] },
      LAYER_FILL,
    );
    expect(onCountryHover).toHaveBeenLastCalledWith("FR");
    expect(map.featureStateCalls).toEqual([{ method: "set", id: "FR" }]);
    expect(map.getCanvas().style.cursor).toBe("pointer");

    map.fire(
      "mousemove",
      { features: [{ id: "DE", properties: { iso: "DE" } }] },
      LAYER_FILL,
    );
    expect(onCountryHover).toHaveBeenLastCalledWith("DE");
    expect(map.featureStateCalls).toEqual([
      { method: "set", id: "FR" },
      { method: "remove", id: "FR" },
      { method: "set", id: "DE" },
    ]);

    map.fire("mouseleave", undefined, LAYER_FILL);
    expect(onCountryHover).toHaveBeenLastCalledWith(null);
    expect(map.getCanvas().style.cursor).toBe("");
  });
});
