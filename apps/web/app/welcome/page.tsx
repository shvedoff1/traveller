"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { USERNAME_REGEX } from "@traveller/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ApiError, api } from "../../lib/api-client";

export default function WelcomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");

  const valid = USERNAME_REGEX.test(username);
  const showFormatHint = username.length > 0 && !valid;

  const claim = useMutation({
    mutationFn: (name: string) => api.updateMe({ username: name }),
    onSuccess: (me) => {
      queryClient.setQueryData(["me"], me);
      router.push("/");
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid) claim.mutate(username);
  }

  const errorMessage =
    claim.error instanceof ApiError && claim.error.status === 409
      ? "That username is already taken."
      : claim.error instanceof ApiError && claim.error.status === 401
        ? "Your session expired — log in again."
        : claim.isError
          ? "Something went wrong — try again."
          : null;

  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome!</h1>
        <p className="mt-2 text-sm text-muted">
          Claim your username — it becomes your public profile URL.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block text-sm" htmlFor="username">
            Username
          </label>
          <div className="flex items-center rounded-lg border border-white/20 px-3">
            <span className="text-sm text-muted">
              traveller.app/
            </span>
            <input
              id="username"
              type="text"
              required
              autoFocus
              value={username}
              onChange={(event) =>
                setUsername(event.target.value.toLowerCase())
              }
              placeholder="your_name"
              className="w-full bg-transparent py-2 pl-0.5 text-sm outline-none"
              aria-invalid={showFormatHint}
            />
          </div>
          {showFormatHint ? (
            <p className="text-sm text-red-400" role="alert">
              3–30 characters: lowercase letters, digits and underscore.
            </p>
          ) : null}
          {errorMessage ? (
            <p className="text-sm text-red-400" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!valid || claim.isPending}
            className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            {claim.isPending ? "Claiming…" : "Claim username"}
          </button>
        </form>
      </div>
    </main>
  );
}
