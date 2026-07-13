/**
 * Pure helpers for the globe ↔ flat (mercator) projection toggle: the state
 * transition plus per-tab (sessionStorage) persistence. Kept WebGL-free so
 * they are unit-testable.
 */

export type Projection = "globe" | "mercator";

export const PROJECTION_STORAGE_KEY = "traveller:map-projection";

/** Toggle between the two supported projections. */
export function nextProjection(current: Projection): Projection {
  return current === "globe" ? "mercator" : "globe";
}

type ReadableStorage = Pick<Storage, "getItem"> | null | undefined;
type WritableStorage = Pick<Storage, "setItem"> | null | undefined;

/**
 * Read the persisted projection, defaulting to `globe` when nothing (or an
 * unrecognised value) is stored, or when storage is unavailable.
 */
export function readProjection(storage: ReadableStorage): Projection {
  try {
    return storage?.getItem(PROJECTION_STORAGE_KEY) === "mercator"
      ? "mercator"
      : "globe";
  } catch {
    // Private-mode / disabled storage — fall back to the default.
    return "globe";
  }
}

/** Persist the chosen projection for this tab (best-effort). */
export function persistProjection(
  storage: WritableStorage,
  projection: Projection,
): void {
  try {
    storage?.setItem(PROJECTION_STORAGE_KEY, projection);
  } catch {
    // Ignore storage failures — the toggle still works for this session.
  }
}
