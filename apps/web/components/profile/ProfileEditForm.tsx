"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type MeResponse } from "@traveller/shared";
import { type FormEvent, useState } from "react";

import { revalidateProfile } from "../../app/actions/revalidate-profile";
import { api } from "../../lib/api-client";
import {
  type ProfileFields,
  buildUpdate,
  displayNameError,
  updateErrorMessage,
  usernameError,
} from "../../lib/settings/form";

/**
 * Compact inline editor for the profile card — the owner edits their display
 * name and username right where they show, without a trip to /settings. Shares
 * the settings-form validation helpers (regex, 409 handling). On success it
 * primes `['me']`, busts the ISR cache for the affected profile paths so the
 * change shows on reload, and hands the updated user back to the header so the
 * card reflects it instantly.
 */
export function ProfileEditForm({
  current,
  onSaved,
  onCancel,
}: {
  current: ProfileFields;
  onSaved: (updated: MeResponse) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(current.displayName);
  const [username, setUsername] = useState(current.username);

  const nameError = displayNameError(displayName);
  const handleError = usernameError(username);
  const update = buildUpdate(current, { displayName, username });
  const canSubmit =
    nameError === null && handleError === null && update !== null;

  const save = useMutation({
    mutationFn: (body: NonNullable<typeof update>) => api.updateMe(body),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["me"], updated);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      // Bust the cached HTML for both the old and (possibly changed) new path.
      await revalidateProfile([current.username, updated.username ?? ""]);
      onSaved(updated);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit && update) save.mutate(update);
  }

  const showNameError = nameError !== null && displayName !== current.displayName;
  const showHandleError = handleError !== null && username !== current.username;
  const usernameChanged = username !== current.username;
  const submitError = save.isError ? updateErrorMessage(save.error) : null;

  return (
    <form
      onSubmit={onSubmit}
      className="mt-1 space-y-3"
      data-testid="profile-edit-form"
    >
      <div className="space-y-1">
        <label className="sr-only" htmlFor="profile-edit-name">
          Display name
        </label>
        <input
          id="profile-edit-name"
          type="text"
          required
          autoFocus
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Your name"
          data-testid="profile-edit-name-input"
          aria-invalid={showNameError}
          className="w-full rounded-lg border border-edge-strong bg-transparent px-2.5 py-1.5 text-sm font-semibold outline-none"
        />
        {showNameError ? (
          <p className="text-xs text-danger" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="sr-only" htmlFor="profile-edit-username">
          Username
        </label>
        <div className="flex items-center rounded-lg border border-edge-strong px-2.5">
          <span aria-hidden className="text-sm text-muted">
            @
          </span>
          <input
            id="profile-edit-username"
            type="text"
            required
            value={username}
            onChange={(event) =>
              setUsername(event.target.value.toLowerCase())
            }
            placeholder="your_name"
            data-testid="profile-edit-username-input"
            aria-invalid={showHandleError}
            className="w-full bg-transparent py-1.5 pl-0.5 text-sm outline-none"
          />
        </div>
        {showHandleError ? (
          <p className="text-xs text-danger" role="alert">
            {handleError}
          </p>
        ) : usernameChanged ? (
          <p className="text-xs text-muted">
            Changing your username changes this profile’s URL.
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p
          className="text-xs text-danger"
          role="alert"
          data-testid="profile-edit-error"
        >
          {submitError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit || save.isPending}
          data-testid="profile-edit-save"
          className="rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity disabled:opacity-40 max-md:min-h-11"
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={save.isPending}
          data-testid="profile-edit-cancel"
          className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-40 max-md:min-h-11"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
