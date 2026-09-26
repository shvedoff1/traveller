import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAP_MODE,
  MAP_MODE_STORAGE_KEY,
  isModeShortcut,
  nextMapMode,
  persistMapMode,
  readMapMode,
} from "../lib/map/map-mode";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const key = (
  keyName: string,
  target: Partial<HTMLElement> | null = null,
  modifiers: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {},
) => ({
  key: keyName,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...modifiers,
  target: target as EventTarget | null,
});

describe("map mode", () => {
  it("defaults to view and flips between the two modes", () => {
    expect(DEFAULT_MAP_MODE).toBe("view");
    expect(nextMapMode("view")).toBe("edit");
    expect(nextMapMode("edit")).toBe("view");
  });

  it("round-trips through storage, view for anything unknown", () => {
    const storage = memoryStorage();
    expect(readMapMode(storage)).toBe("view");
    persistMapMode(storage, "edit");
    expect(storage.data.get(MAP_MODE_STORAGE_KEY)).toBe("edit");
    expect(readMapMode(storage)).toBe("edit");
    expect(readMapMode(memoryStorage({ [MAP_MODE_STORAGE_KEY]: "zzz" }))).toBe(
      "view",
    );
    expect(readMapMode(null)).toBe("view");
  });

  it("survives throwing storage", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readMapMode(broken)).toBe("view");
    expect(() => persistMapMode(broken, "edit")).not.toThrow();
  });

  it("treats a bare E outside form fields as the shortcut", () => {
    expect(isModeShortcut(key("e", { tagName: "BODY" }))).toBe(true);
    expect(isModeShortcut(key("E", { tagName: "DIV" }))).toBe(true);
    expect(isModeShortcut(key("x", { tagName: "BODY" }))).toBe(false);
    expect(isModeShortcut(key("e", { tagName: "INPUT" }))).toBe(false);
    expect(isModeShortcut(key("e", { tagName: "TEXTAREA" }))).toBe(false);
    expect(isModeShortcut(key("e", { tagName: "SELECT" }))).toBe(false);
    expect(
      isModeShortcut(key("e", { tagName: "DIV", isContentEditable: true })),
    ).toBe(false);
    expect(
      isModeShortcut(key("e", { tagName: "BODY" }, { metaKey: true })),
    ).toBe(false);
  });
});
