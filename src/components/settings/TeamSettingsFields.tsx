'use client';
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

export interface TeamSettingsFieldsProps {
  value: TeamGenSettings;
  onChange: (next: TeamGenSettings) => void;
  /** Prefix for element ids so several forms can coexist. */
  idPrefix?: string;
  className?: string;
}

const ALL_GENS: Generation[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const MODE_OPTIONS: { value: GenerationMode; label: string }[] = [
  { value: 'balanced', label: 'Balanced — viable Pokémon with Showdown sets' },
  { value: 'competitive', label: 'Competitive — favors strong Pokémon' },
  { value: 'random', label: 'Random — anything in the dex' },
  { value: 'chaos', label: 'Chaos — random moves, abilities and items' },
];

const LEGENDARY_OPTIONS: { value: LegendaryPolicy; label: string }[] = [
  { value: 'all', label: 'Allow all legendaries' },
  { value: 'no-restricted', label: 'No restricted legendaries or Mythicals' },
  { value: 'none', label: 'No legendaries, Ultra Beasts or Paradox' },
];

const LEVEL_OPTIONS: { value: `${BattleLevel}`; label: string }[] = [
  { value: '100', label: 'Level 100' },
  { value: '50', label: 'Level 50' },
];

function sameGens(a: Generation[], b: Generation[]): boolean {
  return a.length === b.length && [...a].sort().every((g, i) => g === [...b].sort()[i]);
}

/**
 * Team generation settings: generation presets + per-generation checkboxes, legendary policy, mode and level.
 * Controlled; at least one generation always stays selected.
 */
export function TeamSettingsFields({ value, onChange, idPrefix = 'team', className }: TeamSettingsFieldsProps) {
  const activePreset = GENERATION_PRESETS.find((p) => sameGens(p.gens, value.gens))?.id ?? 'custom';

  const toggleGen = (gen: Generation) => {
    const has = value.gens.includes(gen);
    if (has && value.gens.length === 1) return; // keep at least one
    const gens = has ? value.gens.filter((g) => g !== gen) : [...value.gens, gen].sort((a, b) => a - b);
    onChange({ ...value, gens });
  };

  return (
    <div className={cn('space-y-5', className)}>
      <fieldset>
        <legend className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Generations</legend>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Generation presets">
          {GENERATION_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ ...value, gens: [...p.gens] })}
              aria-pressed={activePreset === p.id}
              className={cn('btn btn-sm', activePreset === p.id ? 'btn-primary' : 'btn-secondary')}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
          {ALL_GENS.map((gen) => {
            const checked = value.gens.includes(gen);
            const id = `${idPrefix}-gen-${gen}`;
            return (
              <label
                key={gen}
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-1.5 rounded-ds border-2 px-2 py-2 text-xs font-extrabold select-none',
                  checked ? 'border-[#a9ead0] bg-green/20 text-text' : 'border-border bg-bg/50 text-muted',
                )}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleGen(gen)}
                  className="size-3.5 accent-[var(--color-green)]"
                />
                Gen {gen}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          {value.gens.length === 9 ? 'All nine generations' : `${value.gens.length} of 9 generations`} in the pool. At least one
          must stay selected.
        </p>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Select<LegendaryPolicy>
          label="Legendaries"
          value={value.legendaries}
          onChange={(legendaries) => onChange({ ...value, legendaries })}
          options={LEGENDARY_OPTIONS}
        />
        <Select<GenerationMode>
          label="Randomization"
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode })}
          options={MODE_OPTIONS}
        />
        <Select<`${BattleLevel}`>
          label="Battle level"
          value={`${value.level}`}
          onChange={(level) => onChange({ ...value, level: Number(level) as BattleLevel })}
          options={LEVEL_OPTIONS}
        />
      </div>
    </div>
  );
}
