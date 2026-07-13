import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "../app/page";
import { LAYER_FILL } from "../lib/map/map-style";
import { useMapStore } from "../lib/stores/map-store";
import { MockMap } from "./mocks/maplibre-gl";

vi.mock("maplibre-gl", () => import("./mocks/maplibre-gl"));

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
    MockMap.instances = [];
    useMapStore.setState(useMapStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a full-viewport map", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("application", { name: "Interactive world map" }),
    ).toBeInTheDocument();
    expect(MockMap.instances).toHaveLength(1);
  });

  it("toggles a country in the local visited set when clicked", () => {
    render(<HomePage />);
    const map = lastMap();

    clickCountry(map, "FR");
    expect(useMapStore.getState().visited).toEqual(["FR"]);
    expect(useMapStore.getState().selected).toBe("FR");

    clickCountry(map, "FR");
    expect(useMapStore.getState().visited).toEqual([]);
  });

  it("ignores clicks on geometries outside the canonical country list", () => {
    render(<HomePage />);
    clickCountry(lastMap(), "XK");
    expect(useMapStore.getState().visited).toEqual([]);
    expect(useMapStore.getState().selected).toBeNull();
  });
});
