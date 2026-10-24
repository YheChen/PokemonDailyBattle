'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';

export interface CountdownProps {
  /** Returns the remaining milliseconds (called every second). */
  getMs: () => number;
  /** Text before the time, e.g. "Next daily in". */
  prefix?: string;
  /** Called once when the countdown reaches zero. */
  onElapsed?: () => void;
  className?: string;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

/** "Next daily in 5h 03m 12s" ticking every second (renders an empty slot until mounted). */
export function Countdown({ getMs, prefix = 'Next daily in', onElapsed, className }: CountdownProps) {
  const [text, setText] = useState<string>('');
  const elapsedRef = useRef(false);
  const onElapsedRef = useRef(onElapsed);

  useEffect(() => {
    onElapsedRef.current = onElapsed;
  }, [onElapsed]);

  useEffect(() => {
    const tick = () => {
      const ms = getMs();
      setText(formatCountdown(ms));
      if (ms <= 0) {
        if (!elapsedRef.current) {
          elapsedRef.current = true;
          onElapsedRef.current?.();
        }
      } else {
        elapsedRef.current = false;
      }
    };
    const id = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(id);
  }, [getMs]);

  return (
    <span className={cn('inline-flex items-baseline gap-2 font-pixel text-xl leading-none text-muted', className)} role="timer" aria-live="off">
      {prefix ? <span>{prefix}</span> : null}
      <span className="min-w-[7.5ch] text-yellow">{text || '—'}</span>
    </span>
  );
}
