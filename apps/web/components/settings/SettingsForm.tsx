"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type MeResponse } from "@traveller/shared";
import { type FormEvent, useState } from "react";

import { api } from "../../lib/api-client";
import {
  type ProfileFields,
  buildUpdate,
  displayNameError,
  updateErrorMessage,
  usernameError,
} from "../../lib/settings/form";
import { pushSuccessToast } from "../../lib/stores/toast-store";

/**
 * Edit-profile form: change displayName and/or username via PATCH /me.
 * Prefilled from the current user, live field validation, inline handling
 * of the 409 taken-username case, and a success toast + ['me'] invalidation.
 */
export function SettingsForm({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const current: ProfileFields = {
    displayName: me.displayName,
    username: me.username ?? "",
  };

  const [displayName, setDisplayName] = useState(current.displayName);
  const [username, setUsername] = useState(current.username);

  const nameError = displayNameError(displayName);
  const handleError = usernameError(username);
  const update = buildUpdate(current, { displayName, username });
  const canSubmit = nameError === null && handleError === null && update !== null;

  const save = useMutation({
    mutationFn: (body: NonNullable<typeof update>) => api.updateMe(body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      pushSuccessToast("Profile updated.");
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit && update) save.mutate(update);
  }

  // Only show format hints once the field diverges from what's saved, so a
  // freshly-loaded form isn't shouting at you.
  const showNameError = nameError !== null && displayName !== current.displayName;
  const showHandleError = handleError !== null && username !== current.username;
  const usernameChanged = username !== current.username;
  const submitError = save.isError ? updateErrorMessage(save.error) : null;

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5" data-testid="settings-form">
      <div className="space-y-2">
        <label className="block text-sm" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Your name"
          data-testid="display-name-input"
          aria-invalid={showNameError}
          className="w-full rounded-lg border border-edge-strong bg-transparent px-3 py-2 text-sm outline-none"
        />
        {showNameError ? (
          <p className="text-sm text-danger" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm" htmlFor="username">
          Username
        </label>
        <div className="flex items-center rounded-lg border border-edge-strong px-3">
          <span className="text-sm text-muted">traveller.app/</span>
          <input
            id="username"
            type="text"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            placeholder="your_name"
            data-testid="username-input"
            aria-invalid={showHandleError}
            className="w-full bg-transparent py-2 pl-0.5 text-sm outline-none"
          />
        </div>
        {showHandleError ? (
          <p className="text-sm text-danger" role="alert">
            {handleError}
          </p>
        ) : usernameChanged ? (
          <p className="text-xs text-muted">
            Changing your username changes your public profile URL.
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p className="text-sm text-danger" role="alert" data-testid="settings-error">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit || save.isPending}
        data-testid="settings-save"
        className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
      >
        {save.isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
