'use client';
import { useId } from 'react';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { TYPE_NAMES, typeColor, typeTextColor } from '@/lib/data/typeColors';
import { GENERATIONS, type LegendaryFilter, type PokedexSort } from '@/lib/data/pokedex';
import { FilterChip } from './FilterChip';

export interface PokedexFilterState {
  query: string;
  gens: number[];
  types: string[];
  legendary: LegendaryFilter;
  showForms: boolean;
  sort: PokedexSort;
}

export const DEFAULT_FILTERS: PokedexFilterState = {
  query: '',
  gens: [],
  types: [],
  legendary: 'all',
  showForms: false,
  sort: 'number',
};

export interface PokedexFiltersProps {
  value: PokedexFilterState;
  onChange: (next: PokedexFilterState) => void;
  /** Number of matching entries (shown next to the reset button). */
  count?: number;
  disabled?: boolean;
}

const LEGENDARY_OPTIONS: { value: LegendaryFilter; label: string }[] = [
  { value: 'all', label: 'All Pokémon' },
  { value: 'only', label: 'Legendaries only' },
  { value: 'none', label: 'No legendaries' },
];
const SORT_OPTIONS: { value: PokedexSort; label: string }[] = [
  { value: 'number', label: 'Dex number' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'bst', label: 'Base stat total' },
];

function toggleIn<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Search box + generation/type chips + legendary/forms/sort controls for the Pokédex list. */
export function PokedexFilters({ value, onChange, count, disabled }: PokedexFiltersProps) {
  const searchId = useId();
  const set = (patch: Partial<PokedexFilterState>) => onChange({ ...value, ...patch });
  const isDefault =
    !value.query && value.gens.length === 0 && value.types.length === 0 && value.legendary === 'all' && !value.showForms && value.sort === 'number';

  return (
    <div className="ds-panel space-y-4 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={searchId} className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Search
          </label>
          <div className="relative">
            <input
              id={searchId}
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Name or #number…"
              value={value.query}
              disabled={disabled}
              onChange={(e) => set({ query: e.target.value })}
              className="w-full rounded-ds border-2 border-border bg-surface-2 py-2 pl-9 pr-3 text-sm font-bold text-text placeholder:text-muted/70 shadow-[inset_2px_2px_0_rgba(255,255,255,0.1),inset_-2px_-2px_0_rgba(0,0,0,0.3)] hover:border-border-light disabled:opacity-50"
            />
            <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted">
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M13 13l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <Select<LegendaryFilter>
          label="Legendaries"
          options={LEGENDARY_OPTIONS}
          value={value.legendary}
          onChange={(legendary) => set({ legendary })}
          disabled={disabled}
          className="md:w-48"
        />
        <Select<PokedexSort>
          label="Sort by"
          options={SORT_OPTIONS}
          value={value.sort}
          onChange={(sort) => set({ sort })}
          disabled={disabled}
          className="md:w-44"
        />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-extrabold uppercase tracking-wide text-muted">Generation</legend>
        <div className="flex flex-wrap gap-1.5">
          {GENERATIONS.map((g) => (
            <FilterChip key={g} active={value.gens.includes(g)} onToggle={() => set({ gens: toggleIn(value.gens, g) })} title={`Generation ${g}`}>
              Gen {g}
            </FilterChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-extrabold uppercase tracking-wide text-muted">Type</legend>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_NAMES.map((t) => (
            <FilterChip
              key={t}
              active={value.types.includes(t)}
              onToggle={() => set({ types: toggleIn(value.types, t) })}
              activeStyle={{ backgroundColor: typeColor(t), color: typeTextColor(t), borderColor: typeColor(t) }}
              className="uppercase tracking-wide"
            >
              {t}
            </FilterChip>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 border-t-2 border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <Toggle
          checked={value.showForms}
          onChange={(showForms) => set({ showForms })}
          label="Show alternate forms"
          description="Regional forms, Rotom appliances, Lycanroc-Dusk and friends."
          disabled={disabled}
          className="sm:max-w-md"
        />
        <div className="flex items-center gap-3">
          {typeof count === 'number' ? (
            <span className="font-pixel text-xl text-muted" aria-live="polite">
              {count.toLocaleString()} {count === 1 ? 'Pokémon' : 'Pokémon'}
            </span>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)} disabled={disabled || isDefault}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
