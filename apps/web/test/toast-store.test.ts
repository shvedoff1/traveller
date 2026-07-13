import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_TOASTS,
  pushErrorToast,
  useToastStore,
} from "../lib/stores/toast-store";

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe("toast store", () => {
  it("pushes toasts with unique ids", () => {
    pushErrorToast("one");
    pushErrorToast("two");
    const { toasts } = useToastStore.getState();
    expect(toasts.map((toast) => toast.message)).toEqual(["one", "two"]);
    expect(new Set(toasts.map((toast) => toast.id)).size).toBe(2);
  });

  it("collapses duplicate messages while one is visible", () => {
    pushErrorToast("same");
    pushErrorToast("same");
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("caps the stack at MAX_TOASTS, dropping the oldest", () => {
    for (let index = 0; index < MAX_TOASTS + 2; index += 1) {
      pushErrorToast(`toast-${index}`);
    }
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(MAX_TOASTS);
    expect(toasts[0]?.message).toBe("toast-2");
  });

  it("dismisses a toast by id", () => {
    pushErrorToast("bye");
    const id = useToastStore.getState().toasts[0]!.id;
    useToastStore.getState().dismissToast(id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });
});
