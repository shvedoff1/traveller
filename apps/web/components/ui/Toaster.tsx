"use client";

import { useEffect } from "react";

import { type Toast, useToastStore } from "../../lib/stores/toast-store";

const AUTO_HIDE_MS = 5000;

/**
 * Bottom-center stack of toasts — errors (failed mutations, network errors)
 * and success confirmations. Each toast auto-hides and can be dismissed;
 * screen readers get them via role="alert".
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
      data-testid="toaster"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismissToast = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismissToast]);

  const isSuccess = toast.variant === "success";

  return (
    <div
      role="alert"
      data-testid={isSuccess ? "success-toast" : "error-toast"}
      className="animate-rise pointer-events-auto flex items-center gap-3 rounded-full border border-edge bg-surface px-4 py-2 text-sm shadow-2xl backdrop-blur-xl"
    >
      <span aria-hidden className={isSuccess ? "text-accent" : "text-danger"}>
        {isSuccess ? "✓" : "⚠"}
      </span>
      <span>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(toast.id)}
        className="rounded-full px-1 text-muted transition-colors duration-200 ease-out hover:text-foreground max-md:min-h-11 max-md:min-w-8"
      >
        ×
      </button>
    </div>
  );
}
