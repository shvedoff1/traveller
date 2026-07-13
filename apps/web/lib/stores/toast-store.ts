import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
}

export interface ToastStoreState {
  toasts: Toast[];
  /**
   * Show an error toast. Consecutive duplicates collapse into one (a burst
   * of failed optimistic mutations shouldn't stack identical messages).
   */
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let nextToastId = 1;

/** Capped so a runaway error loop can't fill the screen. */
export const MAX_TOASTS = 3;

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  pushToast: (message) =>
    set((state) => {
      if (state.toasts.some((toast) => toast.message === message)) {
        return state;
      }
      return {
        toasts: [
          ...state.toasts.slice(-(MAX_TOASTS - 1)),
          { id: nextToastId++, message },
        ],
      };
    }),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));

/** Convenience for non-hook call sites (mutation onError callbacks). */
export function pushErrorToast(message: string): void {
  useToastStore.getState().pushToast(message);
}
