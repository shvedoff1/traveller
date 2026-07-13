import { beforeEach, describe, expect, it } from "vitest";

import { useMapStore } from "../lib/stores/map-store";

describe("map store", () => {
  beforeEach(() => {
    useMapStore.setState(useMapStore.getInitialState(), true);
  });

  it("starts empty", () => {
    const state = useMapStore.getState();
    expect(state.selected).toBeNull();
    expect(state.hovered).toBeNull();
    expect(state.visited).toEqual([]);
  });

  it("selects and hovers countries", () => {
    useMapStore.getState().setSelected("FR");
    useMapStore.getState().setHovered("JP");
    expect(useMapStore.getState().selected).toBe("FR");
    expect(useMapStore.getState().hovered).toBe("JP");

    useMapStore.getState().setHovered(null);
    expect(useMapStore.getState().hovered).toBeNull();
  });

  it("toggles visited countries on and off", () => {
    const { toggleVisited } = useMapStore.getState();
    toggleVisited("FR");
    toggleVisited("JP");
    expect(useMapStore.getState().visited).toEqual(["FR", "JP"]);

    toggleVisited("FR");
    expect(useMapStore.getState().visited).toEqual(["JP"]);
  });
});
