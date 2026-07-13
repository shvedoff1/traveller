/** Pulsing placeholder block for loading states. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-testid="skeleton"
      className={`block animate-pulse rounded-lg bg-surface-strong motion-reduce:animate-none ${className}`}
    />
  );
}

/** A friend-card-shaped skeleton row (avatar + two text lines). */
export function FriendCardSkeleton() {
  return (
    <li
      aria-hidden
      className="flex items-center gap-3 rounded-2xl border border-edge bg-surface p-3"
    >
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-44" />
      </span>
      <Skeleton className="h-8 w-20 rounded-full" />
    </li>
  );
}
