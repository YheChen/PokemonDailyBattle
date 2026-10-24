'use client';
import type { KeyboardEvent } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { cn } from '@/components/ui/cn';

export interface LeadPickerProps {
  sets: PokemonSet[];
  leadIndex: number;
  onChange: (index: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Compact row of party icons for choosing the lead (radio group with arrow-key navigation).
 */
export function LeadPicker({ sets, leadIndex, onChange, disabled, className }: LeadPickerProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !sets.length) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (leadIndex + 1) % sets.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (leadIndex - 1 + sets.length) % sets.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = sets.length - 1;
    if (next !== null) {
      e.preventDefault();
      onChange(next);
      const target = e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[next];
      target?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Choose your lead Pokémon"
      onKeyDown={onKeyDown}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {sets.map((set, i) => {
        const active = i === leadIndex;
        return (
          <button
            key={`${set.species}-${i}`}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${set.species}${active ? ' (lead)' : ''}`}
            title={`${set.species}${active ? ' — lead' : ''}`}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(i)}
            className={cn(
              'relative flex h-10 w-12 items-center justify-center rounded-ds border-2 bg-bg/60 transition-colors',
              active ? 'border-yellow bg-yellow/15' : 'border-border hover:border-border-light',
              disabled && 'cursor-not-allowed opacity-50',
              'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-yellow',
            )}
          >
            <PokemonSprite species={set.species} variant="icon" alt="" />
            {active ? (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-sm bg-yellow px-1 font-display text-[0.4rem] uppercase text-[#1a1a1a]">
                Lead
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
