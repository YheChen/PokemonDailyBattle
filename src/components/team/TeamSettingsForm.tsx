'use client';
import { useId } from 'react';
import {
  GENERATION_PRESETS,
  type BattleLevel,
  type Generation,
  type GenerationMode,
  type LegendaryPolicy,
  type TeamGenSettings,
} from '@/lib/teams/types';
import { Select } from '@/components/ui/Select';
import { cn } from '@/components/ui/cn';

export interface TeamSettingsFormProps {
  value: TeamGenSettings;
  onChange: (next: TeamGenSettings) => void;
  disabled?: boolean;
  /** Hide the level field (e.g. when the mode fixes it). */
  hideLevel?: boolean;
  className?: string;
}

const ALL_GENS: Generation[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const MODE_OPTIONS: { value: GenerationMode; label: string; hint: string }[] = [
  { value: 'balanced', label: 'Balanced', hint: 'Viable Pokémon with Showdown random-battle sets.' },
  { value: 'competitive', label: 'Competitive', hint: 'Favors strong Pokémon (high base stats) and gen 9 sets.' },
  { value: 'random', label: 'Random', hint: 'Any Pokémon of the selected generations, NFEs included.' },
  { value: 'chaos', label: 'Chaos', hint: 'Random moves, abilities and items. Anything can happen.' },
];

export const LEGENDARY_OPTIONS: { value: LegendaryPolicy; label: string }[] = [
  { value: 'all', label: 'Allow all legendaries' },
  { value: 'no-restricted', label: 'No restricted legendaries / mythicals' },
  { value: 'none', label: 'No legendaries at all' },
];

export const LEVEL_OPTIONS: { value: `${BattleLevel}`; label: string }[] = [
  { value: '100', label: 'Level 100' },
  { value: '50', label: 'Level 50' },
];

function sortGens(gens: Generation[]): Generation[] {
  return [...gens].sort((x, y) => x - y) as Generation[];
}

function sameGens(a: Generation[], b: Generation[]): boolean {
  if (a.length !== b.length) return false;
  const sa = sortGens(a);
  const sb = sortGens(b);
  return sa.every((g, i) => g === sb[i]);
}

/**
 * Inline team generation settings: generation presets + per-generation checkboxes, legendary policy,
 * randomization mode and battle level.
 */
export function TeamSettingsForm({ value, onChange, disabled, hideLevel, className }: TeamSettingsFormProps) {
  const gensId = useId();
  const gens: Generation[] = value.gens.length ? value.gens : [9];

  const setGens = (next: Generation[]) => {
    if (!next.length) return; // keep at least one generation
    onChange({ ...value, gens: sortGens(next) });
  };

  const toggleGen = (g: Generation) => {
    if (gens.includes(g)) {
      if (gens.length === 1) return;
      setGens(gens.filter((x) => x !== g));
    } else {
      setGens([...gens, g]);
    }
  };

  const modeHint = MODE_OPTIONS.find((m) => m.value === value.mode)?.hint;

  return (
    <div className={cn('grid gap-4', className)}>
      <fieldset disabled={disabled} className="min-w-0">
        <legend className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Generations</legend>
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Generation presets">
          {GENERATION_PRESETS.map((p) => {
            const active = sameGens(p.gens, gens);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setGens(p.gens)}
                className={cn('chip cursor-pointer transition-colors hover:border-border-light', active && 'border-[#fbe79b] bg-yellow text-[#1a1a1a]')}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1" id={gensId} role="group" aria-label="Included generations">
          {ALL_GENS.map((g) => {
            const checked = gens.includes(g);
            return (
              <label
                key={g}
                className={cn(
                  'flex h-9 w-11 cursor-pointer select-none items-center justify-center rounded-ds border-2 font-display text-[0.6rem] transition-colors',
                  checked ? 'border-blue bg-blue/20 text-text' : 'border-border bg-bg/40 text-muted hover:border-border-light',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleGen(g)} aria-label={`Generation ${g}`} />
                G{g}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className={cn('grid gap-3', hideLevel ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        <Select<GenerationMode>
          label="Randomization"
          options={MODE_OPTIONS.map(({ value: v, label }) => ({ value: v, label }))}
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode })}
          hint={modeHint}
          disabled={disabled}
        />
        <Select<LegendaryPolicy>
          label="Legendaries"
          options={LEGENDARY_OPTIONS}
          value={value.legendaries}
          onChange={(legendaries) => onChange({ ...value, legendaries })}
          disabled={disabled}
        />
        {!hideLevel ? (
          <Select<`${BattleLevel}`>
            label="Level"
            options={LEVEL_OPTIONS}
            value={`${value.level}`}
            onChange={(lv) => onChange({ ...value, level: lv === '50' ? 50 : 100 })}
            disabled={disabled}
          />
        ) : null}
      </div>
    </div>
  );
}
