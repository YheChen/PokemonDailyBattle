'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';

export interface DialogueBoxProps {
  text: string | null;
  /** Typewriter speed in characters per second (Infinity = whole text at once). */
  cps: number;
  /** Show the "▼" continue indicator once the text has been typed. */
  awaitingInput?: boolean;
  /** Called on click / Enter / Space once the text is fully shown (a first click completes it). */
  onAdvance?: () => void;
  className?: string;
}

/** Typewriter state for `text`; resets when the text changes. */
export function useTypewriter(text: string, cps: number): { shown: string; done: boolean; complete: () => void } {
  const [state, setState] = useState<{ text: string; chars: number }>({ text, chars: cps === Infinity ? text.length : 0 });
  const chars = state.text === text ? state.chars : cps === Infinity ? text.length : 0;
  if (state.text !== text) setState({ text, chars });
  const done = chars >= text.length;
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (done || cps === Infinity) return;
    startRef.current = performance.now();
    const base = chars;
    let raf = 0;
    const tick = (now: number) => {
      const n = base + Math.floor(((now - startRef.current) / 1000) * cps);
      setState((s) => (s.text === text ? { text, chars: Math.min(text.length, Math.max(s.chars, n)) } : s));
      if (n < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `chars` is intentionally not a dependency: the loop owns it until the text changes or completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, cps, done]);

  return {
    shown: text.slice(0, chars),
    done,
    complete: () => setState({ text, chars: text.length }),
  };
}

/** The DS dialogue box: cream panel, pixel font, typewriter text and a bouncing continue cursor. */
export function DialogueBox({ text, cps, awaitingInput, onAdvance, className }: DialogueBoxProps) {
  const value = text ?? '';
  const { shown, done, complete } = useTypewriter(value, cps);

  const activate = () => {
    if (!done) {
      complete();
      return;
    }
    onAdvance?.();
  };

  return (
    <div
      className={cn('dlg', className)}
      role="button"
      tabIndex={0}
      aria-live="polite"
      aria-label={value ? undefined : 'Battle dialogue'}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      data-done={done ? 'true' : 'false'}
    >
      {shown}
      {!value ? <span className="opacity-0">…</span> : null}
      {awaitingInput && done ? (
        <span className="dlg-cursor" aria-hidden>
          ▼
        </span>
      ) : null}
    </div>
  );
}
