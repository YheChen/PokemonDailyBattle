'use client';
import type { Difficulty } from '@/lib/battle/types';
import type { Trainer } from '@/data/trainers/types';
import { DIFFICULTY_LABELS, type DifficultyChoice } from '@/lib/game/results';
import { cn } from '@/components/ui/cn';

export interface DifficultyPickerProps {
  value: DifficultyChoice;
  onChange: (value: DifficultyChoice) => void;
  /** When given, the "Trainer default" option shows the trainer's own rating. */
  trainer?: Trainer | null;
  disabled?: boolean;
  className?: string;
}

const ORDER: Difficulty[] = ['normal', 'hard', 'champion'];

const HINT: Record<Difficulty, string> = {
  normal: 'Picks mostly sensible moves with some randomness.',
  hard: 'Full move and switch evaluation, no noise.',
  champion: 'Hard plus one-turn lookahead and smarter Mega Evolution.',
};

/** Radio chips: Trainer default / Normal / Hard / Champion. */
export function DifficultyPicker({ value, onChange, trainer, disabled, className }: DifficultyPickerProps) {
  const options: { value: DifficultyChoice; label: string; hint: string }[] = [
    {
      value: 'trainer',
      label: trainer ? `Trainer default (${DIFFICULTY_LABELS[trainer.ai]})` : 'Trainer default',
      hint: 'Uses the AI rating of the chosen trainer.',
    },
    ...ORDER.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d], hint: HINT[d] })),
  ];
  const current = options.find((o) => o.value === value);

  return (
    <div className={cn('space-y-1.5', className)}>
      <span className="block text-xs font-extrabold uppercase tracking-wide text-muted">AI difficulty</span>
      <div role="radiogroup" aria-label="AI difficulty" className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              title={o.hint}
              className={cn(
                'chip cursor-pointer transition-colors hover:border-border-light focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-yellow',
                active && 'border-[#ff8a93] bg-accent text-white',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {current ? <p className="text-xs text-muted">{current.hint}</p> : null}
    </div>
  );
}
