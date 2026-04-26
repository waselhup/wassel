import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

export interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a v2 page so it fades in + slides up 8px on mount and on route changes.
 * 300ms ease-ios — matches HANDOFF §8 ("page transitions: fade + 8px translate-y").
 *
 * Skips the animation when the user prefers reduced motion.
 */
function PageTransition({ children, className }: PageTransitionProps) {
  const [location] = useLocation();
  const [enter, setEnter] = useState(false);
  const prevLocation = useRef(location);

  // Re-trigger the animation whenever the path changes.
  useEffect(() => {
    if (prevLocation.current !== location) {
      setEnter(false);
      prevLocation.current = location;
    }
    const id = window.requestAnimationFrame(() => setEnter(true));
    return () => window.cancelAnimationFrame(id);
  }, [location]);

  return (
    <div
      className={cn(
        'will-change-transform transition-all duration-300 ease-ios motion-reduce:transition-none motion-reduce:transform-none',
        enter ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default PageTransition;
