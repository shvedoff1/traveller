import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileEditForm } from "../components/profile/ProfileEditForm";
import type * as ApiClientModule from "../lib/api-client";
import { ApiError, api } from "../lib/api-client";

vi.mock("../lib/api-client", async () => {
  const actual =
    await vi.importActual<typeof ApiClientModule>("../lib/api-client");
  return { ...actual, api: { updateMe: vi.fn() } };
});

vi.mock("../app/actions/revalidate-profile", () => ({
  revalidateProfile: vi.fn().mockResolvedValue(undefined),
}));

const updateMe = vi.mocked(api.updateMe);

function renderForm(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const current = { displayName: "John Carter", username: "john" };

describe("ProfileEditForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("prefills from the current identity and disables save until changed", () => {
    renderForm(
      <ProfileEditForm current={current} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByTestId("profile-edit-name-input")).toHaveValue(
      "John Carter",
    );
    expect(screen.getByTestId("profile-edit-username-input")).toHaveValue(
      "john",
    );
    expect(screen.getByTestId("profile-edit-save")).toBeDisabled();
  });

  it("surfaces the 409 taken-username case inline", async () => {
    updateMe.mockRejectedValue(new ApiError(409));
    renderForm(
      <ProfileEditForm current={current} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("profile-edit-username-input"), {
      target: { value: "maria" },
    });
    fireEvent.click(screen.getByTestId("profile-edit-save"));
    await waitFor(() =>
      expect(screen.getByTestId("profile-edit-error")).toHaveTextContent(
        /already taken/,
      ),
    );
  });

  it("calls onCancel without saving", () => {
    const onCancel = vi.fn();
    renderForm(
      <ProfileEditForm
        current={current}
        onSaved={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("profile-edit-cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(updateMe).not.toHaveBeenCalled();
  });
});
