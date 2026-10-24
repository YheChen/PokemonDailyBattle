'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';

export function hpColor(pct: number): string {
  if (pct > 50) return '#57cc99';
  if (pct > 20) return '#f4d35e';
  return '#e63946';
}

/** Counts a number towards `value` over `duration` ms (rAF), used for the HP digits. */
export function useAnimatedNumber(value: number, duration: number): number {
  const [shown, setShown] = useState(value);
  // The value currently on screen; written only from effects / animation frames.
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (duration <= 0 || from === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = Math.round(from + (value - from) * t);
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return shown;
}

export interface HpBarProps {
  hp: number;
  maxhp: number;
  /** Transition duration in ms (0 = instant). */
  duration: number;
  /** Compact bar used in the party menu. */
  variant?: 'box' | 'party';
  className?: string;
}

/** DS-style HP bar: green > 50 %, yellow 20–50 %, red ≤ 20 %, width animated over `duration`. */
export function HpBar({ hp, maxhp, duration, variant = 'box', className }: HpBarProps) {
  const max = maxhp > 0 ? maxhp : 1;
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div
      className={cn(variant === 'party' ? 'party-hpbar' : 'hpbar', className)}
      role="meter"
      aria-label="HP"
      aria-valuemin={0}
      aria-valuemax={maxhp}
      aria-valuenow={Math.max(0, hp)}
    >
      <div
        className={variant === 'party' ? 'party-hpbar-fill' : 'hpbar-fill'}
        style={{
          width: `${pct}%`,
          backgroundColor: hpColor(pct),
          transitionDuration: variant === 'box' ? `${duration}ms` : undefined,
        }}
      />
    </div>
  );
}
