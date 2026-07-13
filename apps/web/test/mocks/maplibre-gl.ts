/**
 * Minimal maplibre-gl stand-in for jsdom tests (no WebGL). Records enough
 * of the Map API surface to assert on wiring: constructor options, event
 * handlers (with a `fire` helper), filters and feature-state.
 */

type Handler = (event?: unknown) => void;

export class MockMap {
  static instances: MockMap[] = [];

  readonly options: Record<string, unknown>;
  readonly handlers = new Map<string, Handler[]>();
  readonly filters = new Map<string, unknown>();
  readonly featureStateCalls: Array<{
    method: "set" | "remove";
    id: unknown;
  }> = [];
  removed = false;

  private readonly canvas = { style: { cursor: "" } };

  constructor(options: Record<string, unknown>) {
    this.options = options;
    MockMap.instances.push(this);
  }

  private key(event: string, layer?: string) {
    return layer ? `${event}:${layer}` : event;
  }

  on(event: string, layerOrHandler: string | Handler, maybeHandler?: Handler) {
    const layered = typeof layerOrHandler === "string";
    const key = this.key(event, layered ? layerOrHandler : undefined);
    const handler = (layered ? maybeHandler : layerOrHandler) as Handler;
    this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler]);
    // The style is local JSON: treat it as loaded immediately.
    if (key === "load") handler({});
    return this;
  }

  off() {
    return this;
  }

  fire(event: string, payload?: unknown, layer?: string) {
    for (const handler of this.handlers.get(this.key(event, layer)) ?? []) {
      handler(payload);
    }
  }

  remove() {
    this.removed = true;
  }

  getCanvas() {
    return this.canvas;
  }

  getLayer(id: string) {
    return { id };
  }

  setFilter(id: string, filter: unknown) {
    this.filters.set(id, filter);
  }

  setFeatureState(target: { id: unknown }, _state: unknown) {
    this.featureStateCalls.push({ method: "set", id: target.id });
  }

  removeFeatureState(target: { id: unknown }, _key?: string) {
    this.featureStateCalls.push({ method: "remove", id: target.id });
  }

  isStyleLoaded() {
    return true;
  }

  getZoom() {
    return 1.4;
  }

  getCenter() {
    return { lng: 0, lat: 20 };
  }

  setCenter() {
    return this;
  }

  readonly flyToCalls: Array<{ center: unknown; zoom?: number }> = [];

  flyTo(options: { center: unknown; zoom?: number }) {
    this.flyToCalls.push(options);
    return this;
  }
}

export default { Map: MockMap };
