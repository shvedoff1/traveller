"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { emailSchema } from "@traveller/shared";
import { type FormEvent, useState } from "react";

import { api } from "../../lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  // Honeypot: real users never see or fill this; bots that auto-fill inputs
  // do, and the API silently drops those requests.
  const [website, setWebsite] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { data: providers } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: api.getProviders,
  });

  const sendLink = useMutation({
    mutationFn: api.requestMagicLink,
    onSuccess: (_data, variables) => setSentTo(variables.email),
  });

  const parsed = emailSchema.safeParse(email);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parsed.success) sendLink.mutate({ email: parsed.data, website });
  }

  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>

        {sentTo ? (
          <div className="mt-6 space-y-2" data-testid="check-inbox">
            <p className="text-sm">
              Check your inbox — we sent a sign-in link to{" "}
              <strong>{sentTo}</strong>.
            </p>
            <p className="text-sm text-muted">
              The link is valid for 15 minutes.
            </p>
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() => setSentTo(null)}
            >
              Use a different address
            </button>
          </div>
        ) : (
          <>
            {providers?.google ? (
              <a
                href={`${API_BASE}/auth/google`}
                className="mt-6 flex w-full items-center justify-center rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium transition-colors duration-200 ease-out hover:bg-surface-strong"
              >
                Continue with Google
              </a>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              {/* Honeypot: off-screen, non-focusable, hidden from AT. Only
                  bots fill it; a non-empty value makes the API drop the send. */}
              <div
                aria-hidden="true"
                className="absolute h-0 w-0 overflow-hidden"
                style={{ left: "-9999px" }}
              >
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>
              <label className="block text-sm" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-edge-strong bg-transparent px-3 py-2 text-sm transition-colors duration-200 ease-out focus:border-muted focus:outline-none"
              />
              <button
                type="submit"
                disabled={!parsed.success || sendLink.isPending}
                className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
              >
                {sendLink.isPending ? "Sending…" : "Email me a magic link"}
              </button>
              {sendLink.isError ? (
                <p role="alert" className="text-sm text-danger">
                  Couldn&apos;t send the link — try again in a few minutes.
                </p>
              ) : null}
            </form>
          </>
        )}
      </div>
    </main>
  );
}
