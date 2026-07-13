import Link from "next/link";

/** 404 — unknown routes and missing public profiles land here. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8 text-center">
        <p aria-hidden className="text-4xl">
          🧭
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Off the map
        </h1>
        <p className="mt-2 text-sm text-muted">
          This page doesn’t exist — maybe the profile moved or the link is
          mistyped.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block min-h-11 content-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 ease-out hover:bg-accent-strong"
        >
          Back to the globe
        </Link>
      </div>
    </main>
  );
}
