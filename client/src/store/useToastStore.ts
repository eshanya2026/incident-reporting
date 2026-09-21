import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  /** Milliseconds before auto-dismiss. */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  show: (type: ToastType, message: string, duration?: number) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;
const DEFAULT_DURATION: Record<ToastType, number> = { success: 3500, info: 4000, error: 6000 };

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (type, message, duration) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration: duration ?? DEFAULT_DURATION[type] }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Toast notifications, used in place of window.alert() so feedback doesn't block the page.
 * Callable from anywhere — event handlers, async callbacks — not just inside components.
 */
export const toast = {
  success: (message: string, duration?: number) => useToastStore.getState().show('success', message, duration),
  error: (message: string, duration?: number) => useToastStore.getState().show('error', message, duration),
  info: (message: string, duration?: number) => useToastStore.getState().show('info', message, duration),
};
