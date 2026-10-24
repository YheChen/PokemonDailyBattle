import { cn } from '@/components/ui/cn';

export interface StepsProps {
  steps: string[];
  /** 0-based index of the current step. */
  current: number;
  className?: string;
}

/** Numbered progress indicator for the multi-step modes (Opponent → Team → Battle → Result). */
export function Steps({ steps, current, className }: StepsProps) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-2 text-xs', className)} aria-label="Progress">
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border-2 font-display text-[0.55rem]',
                state === 'current' && 'border-[#fbe79b] bg-yellow text-[#1a1a1a]',
                state === 'done' && 'border-[#a9ead0] bg-green text-[#082a1c]',
                state === 'todo' && 'border-border bg-bg/40 text-muted',
              )}
              aria-hidden
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className={cn('font-extrabold uppercase tracking-wide', state === 'current' ? 'text-text' : 'text-muted')}>{label}</span>
            {i < steps.length - 1 ? <span aria-hidden className="mx-1 h-0.5 w-4 bg-border/70" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
