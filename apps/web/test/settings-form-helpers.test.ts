import { describe, expect, it } from "vitest";

import { ApiError } from "../lib/api-client";
import {
  DISPLAY_NAME_MAX,
  buildUpdate,
  displayNameError,
  updateErrorMessage,
  usernameError,
} from "../lib/settings/form";

describe("displayNameError", () => {
  it("accepts a normal name", () => {
    expect(displayNameError("John Carter")).toBeNull();
  });

  it("rejects empty / whitespace-only", () => {
    expect(displayNameError("")).toMatch(/can’t be empty/);
    expect(displayNameError("   ")).toMatch(/can’t be empty/);
  });

  it("rejects over-long names", () => {
    expect(displayNameError("a".repeat(DISPLAY_NAME_MAX))).toBeNull();
    expect(displayNameError("a".repeat(DISPLAY_NAME_MAX + 1))).toMatch(
      /under 80/,
    );
  });
});

describe("usernameError", () => {
  it("accepts a valid handle", () => {
    expect(usernameError("john_99")).toBeNull();
  });

  it("rejects empty", () => {
    expect(usernameError("")).toMatch(/can’t be empty/);
  });

  it("rejects out-of-format handles", () => {
    expect(usernameError("ab")).toMatch(/3–30 characters/);
    expect(usernameError("Uppercase")).toMatch(/3–30 characters/);
    expect(usernameError("has space")).toMatch(/3–30 characters/);
  });
});

describe("buildUpdate", () => {
  const current = { displayName: "John", username: "john" };

  it("returns null when nothing changed", () => {
    expect(buildUpdate(current, { displayName: "John", username: "john" })).toBeNull();
  });

  it("trims and includes only the changed displayName", () => {
    expect(buildUpdate(current, { displayName: "  Johnny  ", username: "john" })).toEqual({
      displayName: "Johnny",
    });
  });

  it("includes only the changed username", () => {
    expect(buildUpdate(current, { displayName: "John", username: "jc" })).toEqual({
      username: "jc",
    });
  });

  it("includes both when both changed", () => {
    expect(buildUpdate(current, { displayName: "JC", username: "jc" })).toEqual({
      displayName: "JC",
      username: "jc",
    });
  });

  it("treats a no-op trim as unchanged", () => {
    expect(buildUpdate(current, { displayName: "John ", username: "john" })).toBeNull();
  });
});

describe("updateErrorMessage", () => {
  it("maps 409 to the taken-username message", () => {
    expect(updateErrorMessage(new ApiError(409))).toMatch(/already taken/);
  });

  it("maps 401 to a session-expired message", () => {
    expect(updateErrorMessage(new ApiError(401))).toMatch(/session expired/);
  });

  it("falls back to a generic message otherwise", () => {
    expect(updateErrorMessage(new ApiError(500))).toMatch(/went wrong/);
    expect(updateErrorMessage(new Error("boom"))).toMatch(/went wrong/);
  });
});
