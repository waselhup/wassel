import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';

export interface MorningBriefItem {
  agentId: string;
  message: string;
  expression: string;
  turnId: string;
}

export interface MorningBriefSequenceProps {
  sessionId: string;
  language: 'ar' | 'en';
  /** Called as each brief becomes the focused one. */
  onFocusAgent?: (agentId: string | null) => void;
  /** Fires with every newly-arrived brief. */
  onBrief?: (brief: MorningBriefItem) => void;
  /** Fires once all 8 briefs have been delivered. */
  onComplete?: () => void;
  /** Optional: skip the fetch and use these briefs (useful for tests). */
  initialBriefs?: MorningBriefItem[];
}

/**
 * Drives the morning-brief flow:
 *   1. Fetches all 8 briefs in a single tRPC call.
 *   2. Streams them out one at a time so the user sees the team wake up.
 *
 * The component renders nothing — it's a controller. The parent (WarRoom)
 * uses the callbacks to update the focused seat + push to the chat log.
 */
export default function MorningBriefSequence({
  sessionId,
  language,
  onFocusAgent,
  onBrief,
  onComplete,
  initialBriefs,
}: MorningBriefSequenceProps) {
  const [_started, setStarted] = useState(false);
  const onceRef = useRef(false);

  useEffect(() => {
    if (onceRef.current) return;
    onceRef.current = true;
    setStarted(true);

    let cancelled = false;

    async function run() {
      let briefs: MorningBriefItem[] = initialBriefs || [];
      if (!briefs.length) {
        try {
          const res = await trpc.warRoom.morningBrief({ sessionId, language });
          briefs = (res?.briefs || []) as MorningBriefItem[];
        } catch (err: any) {
          console.error('[war-room] morning brief failed:', err?.message || err);
          onComplete?.();
          return;
        }
      }
      if (cancelled) return;

      for (let i = 0; i < briefs.length; i++) {
        if (cancelled) return;
        const b = briefs[i];
        onFocusAgent?.(b.agentId);
        onBrief?.(b);
        // pause so the user can read each one
        const pauseMs = Math.min(6000, 2200 + Math.floor((b.message.length / 40) * 800));
        await new Promise((r) => setTimeout(r, pauseMs));
      }
      onFocusAgent?.(null);
      onComplete?.();
    }
    run();

    return () => {
      cancelled = true;
    };
  // sessionId is stable per session; we don't want to re-trigger on language flips
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return null;
}
