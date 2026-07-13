import { decideRefresh, hashToken } from "./refresh-token.logic";

const NOW = new Date("2026-07-13T12:00:00Z");
const FUTURE = new Date("2026-08-01T12:00:00Z");
const PAST = new Date("2026-07-01T12:00:00Z");

describe("decideRefresh", () => {
  it("rejects an unknown token", () => {
    expect(decideRefresh(null, NOW)).toEqual({ action: "reject" });
  });

  it("rotates a live token", () => {
    expect(decideRefresh({ expiresAt: FUTURE, revokedAt: null }, NOW)).toEqual({
      action: "rotate",
    });
  });

  it("revokes the family when a rotated token is replayed", () => {
    expect(decideRefresh({ expiresAt: FUTURE, revokedAt: PAST }, NOW)).toEqual({
      action: "revoke_family",
    });
  });

  it("rejects an expired token", () => {
    expect(decideRefresh({ expiresAt: PAST, revokedAt: null }, NOW)).toEqual({
      action: "reject",
    });
  });

  it("treats exactly-now expiry as expired", () => {
    expect(decideRefresh({ expiresAt: NOW, revokedAt: null }, NOW)).toEqual({
      action: "reject",
    });
  });

  it("prefers reuse detection over expiry", () => {
    expect(decideRefresh({ expiresAt: PAST, revokedAt: PAST }, NOW)).toEqual({
      action: "revoke_family",
    });
  });
});

describe("hashToken", () => {
  it("is deterministic sha256 hex", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("differs across inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});
