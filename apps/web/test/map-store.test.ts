import { COUNTRY_CENTROIDS } from "@traveller/shared";
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
    expect(state.highlighted).toBeNull();
    expect(state.flyTo).toBeNull();
    expect(state.loginPromptVisible).toBe(false);
  });

  it("selects, hovers and highlights countries", () => {
    useMapStore.getState().setSelected("FR");
    useMapStore.getState().setHovered("JP");
    useMapStore.getState().setHighlighted("BR");
    expect(useMapStore.getState().selected).toBe("FR");
    expect(useMapStore.getState().hovered).toBe("JP");
    expect(useMapStore.getState().highlighted).toBe("BR");

    useMapStore.getState().setHighlighted(null);
    expect(useMapStore.getState().highlighted).toBeNull();
  });

  it("flies to a country's centroid with a fresh request id each time", () => {
    useMapStore.getState().flyToCountry("FR");
    const first = useMapStore.getState().flyTo;
    const [lng, lat, zoom] = COUNTRY_CENTROIDS["FR"]!;
    expect(first).toMatchObject({ center: [lng, lat], zoom });

    useMapStore.getState().flyToCountry("FR");
    const second = useMapStore.getState().flyTo;
    expect(second?.id).not.toBe(first?.id); // repeats re-trigger
  });

  it("ignores flyTo for codes without a centroid", () => {
    useMapStore.getState().flyToCountry("XX");
    expect(useMapStore.getState().flyTo).toBeNull();
  });

  it("shows and hides the login prompt", () => {
    useMapStore.getState().showLoginPrompt();
    expect(useMapStore.getState().loginPromptVisible).toBe(true);
    useMapStore.getState().hideLoginPrompt();
    expect(useMapStore.getState().loginPromptVisible).toBe(false);
  });
});
