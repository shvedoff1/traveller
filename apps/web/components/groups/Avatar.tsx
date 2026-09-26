/** Round avatar image, or the first letter of the name as a fallback. */
export function Avatar({
  name,
  url,
  className = "size-9 text-sm",
}: {
  name: string;
  url: string | null;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-surface-strong font-semibold uppercase ${className}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}
