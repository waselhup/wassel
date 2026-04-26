/**
 * Toast system — programmatic API used by jobs/UI to fire transient notifications.
 *
 * Mirrors the v2 Toast component's tone vocabulary; the container renders the
 * single most-recent toast at a time (which is what a small mobile screen wants).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Toast, { type ToastTone } from '@/components/v2/Toast';

export interface ToastOptions {
  message: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** ms until auto-dismiss. Default 4000. Pass 0 to keep it sticky. */
  duration?: number;
  /** optional click handler — runs before dismiss */
  onAction?: () => void;
  /** label for the action button (only shown when onAction is set) */
  actionLabel?: string;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface InternalToast extends ToastOptions {
  id: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<InternalToast | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((opts: ToastOptions) => {
    idRef.current += 1;
    setCurrent({ ...opts, id: idRef.current });
  }, []);

  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  // The Toast component handles its own auto-dismiss timer via `duration`.
  // We just need to clear our state when it tells us it's done.
  const value = useMemo<ToastContextValue>(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer current={current} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  current: InternalToast | null;
  onDismiss: () => void;
}

function ToastContainer({ current, onDismiss }: ToastContainerProps) {
  // Track which id we're showing so re-renders don't reset open state.
  const [openId, setOpenId] = useState<number | null>(null);
  useEffect(() => {
    if (current && current.id !== openId) {
      setOpenId(current.id);
    }
  }, [current, openId]);

  if (!current) return null;

  const handleDismiss = () => {
    setOpenId(null);
    onDismiss();
  };

  const handleAction = current.onAction
    ? () => {
        current.onAction!();
        handleDismiss();
      }
    : undefined;

  return (
    <Toast
      open={openId === current.id}
      onDismiss={handleDismiss}
      message={current.message}
      {...(current.description !== undefined ? { description: current.description } : {})}
      tone={current.tone ?? 'info'}
      duration={current.duration ?? 4000}
      action={
        handleAction && current.actionLabel ? (
          <button
            type="button"
            onClick={handleAction}
            className="font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
          >
            {current.actionLabel}
          </button>
        ) : undefined
      }
    />
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
