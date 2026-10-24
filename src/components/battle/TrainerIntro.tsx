'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { assets } from '@/lib/assets/provider';
import { cn } from '@/components/ui/cn';

export interface TrainerIntroCardProps {
  avatar?: string;
  /** "Champion" … (empty for setups without a trainer). */
  title: string;
  name: string;
  /** "Sinnoh · Sinnoh Pokémon League" */
  subtitle: string;
  /** Plays the exit animation. */
  leaving?: boolean;
}

/** The trainer card that slides into the viewport during the intro. */
export function TrainerIntroCard({ avatar, title, name, subtitle, leaving }: TrainerIntroCardProps) {
  const [failed, setFailed] = useState(false);
  const src = avatar ? assets.trainerPortrait(avatar) : null;
  return (
    <div className={cn('bv-intro', leaving && 'bv-intro-leaving')} aria-hidden>
      <div className="bv-intro-portrait">
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
        ) : (
          <svg viewBox="0 0 64 64" className="h-full w-full text-border-light">
            <circle cx="32" cy="22" r="12" fill="currentColor" />
            <path d="M10 62c0-14 10-22 22-22s22 8 22 22z" fill="currentColor" />
          </svg>
        )}
      </div>
      <div className="min-w-0">
        <div className="bv-intro-kicker">Challenger</div>
        <div className="bv-intro-name">{title ? `${title} ${name}` : name}</div>
        {subtitle ? <div className="bv-intro-sub">{subtitle}</div> : null}
      </div>
    </div>
  );
}

export interface IntroSequence {
  /** Index of the current line (`lines.length` once finished). */
  index: number;
  text: string | null;
  done: boolean;
  /** Advances to the next line (click / Enter / Space). */
  advance: () => void;
}

/**
 * Plays dialogue lines one by one: each advances on demand or automatically after `delay` ms.
 * `onDone` fires once after the last line.
 */
export function useIntroSequence(lines: readonly string[], opts: { delay: number; enabled: boolean; onDone: () => void }): IntroSequence {
  const [index, setIndex] = useState(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(opts.onDone);
  useEffect(() => {
    onDoneRef.current = opts.onDone;
  });
  const done = index >= lines.length;

  const advance = useCallback(() => {
    setIndex((i) => Math.min(lines.length, i + 1));
  }, [lines.length]);

  useEffect(() => {
    if (!opts.enabled) return;
    if (done) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDoneRef.current();
      }
      return;
    }
    const t = window.setTimeout(advance, Math.max(60, opts.delay));
    return () => window.clearTimeout(t);
  }, [advance, done, index, opts.delay, opts.enabled]);

  return { index, text: done ? lines[lines.length - 1] ?? null : lines[index] ?? null, done, advance };
}
