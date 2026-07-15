import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type MeResponse } from "@traveller/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsForm } from "../components/settings/SettingsForm";
import type * as ApiClientModule from "../lib/api-client";
import { ApiError, api } from "../lib/api-client";
import { useToastStore } from "../lib/stores/toast-store";

vi.mock("../lib/api-client", async () => {
  const actual =
    await vi.importActual<typeof ApiClientModule>("../lib/api-client");
  return { ...actual, api: { updateMe: vi.fn() } };
});

// The success path fires an on-demand revalidation server action; stub it so
// the test doesn't reach into Next's cache machinery.
vi.mock("../app/actions/revalidate-profile", () => ({
  revalidateProfile: vi.fn().mockResolvedValue(undefined),
}));

const updateMe = vi.mocked(api.updateMe);

const ME: MeResponse = {
  id: "6d2f9c6e-2f9b-4f6c-9a4e-27a2f9adf001",
  username: "john",
  displayName: "john",
  email: "john@example.com",
  avatarUrl: null,
  isPublic: true,
};

let client: QueryClient;

function renderForm(ui: ReactElement) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("SettingsForm", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("prefills the fields from the current user", () => {
    renderForm(<SettingsForm me={ME} />);
    expect(screen.getByTestId("display-name-input")).toHaveValue("john");
    expect(screen.getByTestId("username-input")).toHaveValue("john");
    // Nothing changed yet — save is disabled.
    expect(screen.getByTestId("settings-save")).toBeDisabled();
  });

  it("saves a changed display name: invalidates ['me'] and toasts success", async () => {
    const updated = { ...ME, displayName: "John Carter" };
    updateMe.mockResolvedValue(updated);
    renderForm(<SettingsForm me={ME} />);

    fireEvent.change(screen.getByTestId("display-name-input"), {
      target: { value: "John Carter" },
    });
    const save = screen.getByTestId("settings-save");
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledExactlyOnceWith({
        displayName: "John Carter",
      }),
    );
    await waitFor(() =>
      expect(client.getQueryData(["me"])).toEqual(updated),
    );
    expect(
      useToastStore.getState().toasts.some((t) => t.variant === "success"),
    ).toBe(true);
  });

  it("shows an inline error on a 409 taken username", async () => {
    updateMe.mockRejectedValue(new ApiError(409));
    renderForm(<SettingsForm me={ME} />);

    fireEvent.change(screen.getByTestId("username-input"), {
      target: { value: "maria" },
    });
    fireEvent.click(screen.getByTestId("settings-save"));

    await waitFor(() =>
      expect(screen.getByTestId("settings-error")).toHaveTextContent(
        /already taken/,
      ),
    );
  });

  it("blocks submit on an invalid username", () => {
    renderForm(<SettingsForm me={ME} />);
    fireEvent.change(screen.getByTestId("username-input"), {
      target: { value: "ab" },
    });
    expect(screen.getByTestId("settings-save")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/3–30 characters/);
  });
});
