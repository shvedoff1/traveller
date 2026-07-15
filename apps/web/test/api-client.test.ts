import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  api,
  apiFetch,
} from "../lib/api-client";

const ME = {
  id: "5f0b6f6a-9b1a-4e2a-8c8d-2f6a1b3c4d5e",
  username: "kenji",
  displayName: "Kenji",
  email: "kenji@example.com",
  avatarUrl: null,
  isPublic: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("sends credentials and no CSRF header on GET", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch("/auth/providers");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/providers");
    expect(init?.credentials).toBe("include");
    expect(
      (init?.headers as Record<string, string>)["X-Requested-With"],
    ).toBeUndefined();
  });

  it("sets the CSRF header and JSON body on mutations", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch("/auth/magic-link", {
      method: "POST",
      body: { email: "a@example.com" },
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Requested-With"]).toBe("fetch");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ email: "a@example.com" }));
  });

  it("on 401: refreshes once, then retries the original request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true })) // refresh
      .mockResolvedValueOnce(jsonResponse(ME)); // retry

    const response = await apiFetch("/auth/me");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1]!;
    expect(refreshUrl).toBe("/api/auth/refresh");
    expect(refreshInit?.method).toBe("POST");
    expect(
      (refreshInit?.headers as Record<string, string>)["X-Requested-With"],
    ).toBe("fetch");

    expect(fetchMock.mock.calls[2]![0]).toBe("/api/auth/me");
  });

  it("returns the original 401 when the refresh fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401));

    const response = await apiFetch("/auth/me");

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no retry, no refresh loop
  });

  it("retries at most once even if the retry also 401s", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, 401));

    const response = await apiFetch("/auth/me");

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a transient 5xx refresh, then succeeds (deploy blip)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401)) // original
      .mockResolvedValueOnce(jsonResponse({}, 503)) // refresh: API restarting
      .mockResolvedValueOnce(jsonResponse({ ok: true })) // refresh: recovered
      .mockResolvedValueOnce(jsonResponse(ME)); // retry original

    const response = await apiFetch("/auth/me");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("treats a network-dropped refresh as transient, not a logout", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401)) // original
      .mockRejectedValueOnce(new TypeError("Failed to fetch")) // refresh drops
      .mockResolvedValueOnce(jsonResponse({ ok: true })) // refresh: recovered
      .mockResolvedValueOnce(jsonResponse(ME)); // retry original

    const response = await apiFetch("/auth/me");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("gives up after backoff when refresh stays unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401)) // original
      .mockResolvedValueOnce(jsonResponse({}, 502)) // refresh attempt 1
      .mockResolvedValueOnce(jsonResponse({}, 502)) // refresh attempt 2
      .mockResolvedValueOnce(jsonResponse({}, 502)); // refresh attempt 3

    const response = await apiFetch("/auth/me");

    // Original 401 stands after exhausting the (2) backoff retries.
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("ends the session immediately on a real 401 from refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401)) // original
      .mockResolvedValueOnce(jsonResponse({}, 401)); // refresh: token dead

    const response = await apiFetch("/auth/me");

    // No backoff loop — a genuine logout is not retried.
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never tries to refresh the refresh call itself", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));

    const response = await apiFetch("/auth/refresh", { method: "POST" });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("api helpers", () => {
  it("getMe returns the parsed user", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ME));
    await expect(api.getMe()).resolves.toEqual(ME);
  });

  it("getMe returns null when unauthenticated after a failed refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(api.getMe()).resolves.toBeNull();
  });

  it("getMe rejects malformed payloads", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ nope: true }));
    await expect(api.getMe()).rejects.toThrow();
  });

  it("updateMe PATCHes /me with the CSRF header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ME));

    await api.updateMe({ username: "kenji" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/me");
    expect(init?.method).toBe("PATCH");
    expect(
      (init?.headers as Record<string, string>)["X-Requested-With"],
    ).toBe("fetch");
  });

  it("updateMe surfaces 409 as ApiError", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "taken" }, 409));

    const error = await api.updateMe({ username: "kenji" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
  });

  it("logout resolves on 200 and throws otherwise", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(api.logout()).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(api.logout()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("network failures", () => {
  it("surfaces transport errors as ApiError(0), not a bare TypeError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const error = await apiFetch("/auth/me").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).isNetworkError).toBe(true);
    expect((error as ApiError).message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("propagates network errors through the typed api helpers", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const error = await api.getMe().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isNetworkError).toBe(true);
  });
});
