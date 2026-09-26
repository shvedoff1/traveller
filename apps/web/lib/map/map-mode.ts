/**
 * Map interaction mode — pure helpers, unit-testable.
 *
 * - `view` (default): a click only selects the country and opens its card,
 *   so looking up a name never marks anything by accident.
 * - `edit`: a click toggles visited straight away, for marking in bulk.
 *
 * The choice persists across visits (localStorage).
 */

export type MapMode = "view" | "edit";

export const MAP_MODE_STORAGE_KEY = "traveller:map-mode";
export const DEFAULT_MAP_MODE: MapMode = "view";

export function nextMapMode(mode: MapMode): MapMode {
  return mode === "view" ? "edit" : "view";
}

type ReadableStorage = Pick<Storage, "getItem"> | null | undefined;
type WritableStorage = Pick<Storage, "setItem"> | null | undefined;

/** The stored mode, `view` when nothing valid is stored or storage fails. */
export function readMapMode(storage: ReadableStorage): MapMode {
  try {
    return storage?.getItem(MAP_MODE_STORAGE_KEY) === "edit" ? "edit" : "view";
  } catch {
    return DEFAULT_MAP_MODE;
  }
}

/** Persist the mode (best-effort). */
export function persistMapMode(storage: WritableStorage, mode: MapMode): void {
  try {
    storage?.setItem(MAP_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage unavailable — the mode lasts until reload.
  }
}

/**
 * Whether a keydown should flip the mode: a bare `e`, not while typing in
 * a field and not with modifiers (so browser shortcuts keep working).
 */
export function isModeShortcut(event: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  if (event.key !== "e" && event.key !== "E") return false;
  const target = event.target as HTMLElement | null;
  if (!target || typeof target.tagName !== "string") return true;
  const tag = target.tagName.toLowerCase();
  return !(
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}
