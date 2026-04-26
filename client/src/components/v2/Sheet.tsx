import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

export type SheetSnap = 25 | 50 | 90 | 100;

export interface SheetProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose: () => void;
  /** title rendered above the content (rendered next to the drag handle) */
  title?: ReactNode;
  children?: ReactNode;
  /** snap points the sheet can rest at, expressed as % of viewport height. Default: [50, 90]. */
  snapPoints?: SheetSnap[];
  /** snap point to open at. Defaults to the first entry of `snapPoints`. */
  initialSnap?: SheetSnap;
  /** dismiss when the user taps the scrim. Default: true. */
  dismissOnScrim?: boolean;
}

const DEFAULT_SNAPS: SheetSnap[] = [50, 90];

function Sheet({
  className,
  open,
  onClose,
  title,
  children,
  snapPoints = DEFAULT_SNAPS,
  initialSnap,
  dismissOnScrim = true,
  ...rest
}: SheetProps) {
  const snaps = useMemo(() => [...snapPoints].sort((a, b) => a - b), [snapPoints]);
  const [snap, setSnap] = useState<SheetSnap>(() => initialSnap ?? snaps[0] ?? 50);
  const [drag, setDrag] = useState<number>(0); // px offset while actively dragging
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Reset snap when reopening.
  useEffect(() => {
    if (open) setSnap(initialSnap ?? snaps[0] ?? 50);
  }, [open, initialSnap, snaps]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // On open, move focus into the sheet so screen-reader users land in the
  // dialog and Tab cycles within it. We focus the first interactive element
  // we can find; otherwise fall back to the dialog container itself.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const node = sheetRef.current;
      if (!node) return;
      const firstFocusable = node.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? node).focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  const settle = useCallback((deltaPx: number) => {
    const vh = window.innerHeight || 1;
    const currentTop = (1 - snap / 100) * vh;
    const projectedTop = currentTop + deltaPx;
    const projectedHeightPct = Math.max(0, Math.min(100, (1 - projectedTop / vh) * 100));
    if (projectedHeightPct < snaps[0]! / 2) { onClose(); return; }
    const nearest = snaps.reduce<SheetSnap>((best, s) =>
      Math.abs(s - projectedHeightPct) < Math.abs(best - projectedHeightPct) ? s : best,
    snaps[0]!);
    setSnap(nearest);
  }, [snap, snaps, onClose]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current == null) return;
    setDrag(e.clientY - dragStartY.current);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current == null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;
    setDrag(0);
    settle(delta);
  };

  if (!open) return null;

  const heightPct = snap;
  const transformPx = drag > 0 ? drag : 0; // disallow upward drag past current snap
  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-[60]"
    >
      <div
        onClick={dismissOnScrim ? onClose : undefined}
        className={cn(
          'absolute inset-0 bg-v2-ink/40 backdrop-blur-[2px]',
          'transition-opacity duration-300 ease-ios',
        )}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'focus-visible:outline-none',
          'absolute inset-x-0 bottom-0 flex flex-col bg-v2-surface',
          'rounded-t-v2-xl border-t border-v2-line shadow-lift',
          'transition-[height,transform] duration-300 ease-ios',
          className,
        )}
        style={{
          height: `${heightPct}vh`,
          transform: `translateY(${transformPx}px)`,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        {...rest}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex h-9 cursor-grab items-center justify-center touch-none active:cursor-grabbing"
          aria-label="اسحب لتغيير الحجم"
        >
          <span className="block h-1 w-9 rounded-full bg-v2-line" />
        </div>
        {title && (
          <div className="px-5 pb-3 pt-1 font-ar text-[17px] font-semibold text-v2-ink">{title}</div>
        )}
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export default Sheet;
