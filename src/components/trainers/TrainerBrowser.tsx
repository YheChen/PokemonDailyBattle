'use client';
import { useMemo, useState } from 'react';
import type { Region, Trainer } from '@/data/trainers/types';
import { CHAMPIONS, OTHER_TRAINERS } from '@/data/trainers';
import { useHydrated, useStats } from '@/lib/storage/useStorage';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Heading } from '@/components/ui/Heading';
import { Select } from '@/components/ui/Select';
import { TrainerGrid } from './TrainerGrid';

type RegionFilter = 'all' | Region;
type DifficultyFilter = 'all' | '1' | '2' | '3' | '4' | '5';

const DIFFICULTY_OPTIONS: { value: DifficultyFilter; label: string }[] = [
  { value: 'all', label: 'Any difficulty' },
  { value: '1', label: '★ 1 star' },
  { value: '2', label: '★★ 2 stars' },
  { value: '3', label: '★★★ 3 stars' },
  { value: '4', label: '★★★★ 4 stars' },
  { value: '5', label: '★★★★★ 5 stars' },
];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function matches(t: Trainer, query: string, region: RegionFilter, difficulty: DifficultyFilter): boolean {
  if (region !== 'all' && t.region !== region) return false;
  if (difficulty !== 'all' && String(t.difficulty) !== difficulty) return false;
  if (!query) return true;
  const q = normalize(query);
  const haystack = [t.name, t.title, t.subtitle, t.region, t.signature, ...t.team.map((p) => p.species)]
    .map(normalize)
    .join(' ');
  return haystack.includes(q);
}

/**
 * The /trainers browser: search + region/difficulty filters over the Champions and Famous Trainers groups.
 */
export function TrainerBrowser() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<RegionFilter>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const hydrated = useHydrated();
  const stats = useStats();

  const regions = useMemo(() => {
    const set = new Set<Region>();
    for (const t of [...CHAMPIONS, ...OTHER_TRAINERS]) set.add(t.region);
    return [...set].sort();
  }, []);

  const champions = useMemo(() => CHAMPIONS.filter((t) => matches(t, query, region, difficulty)), [query, region, difficulty]);
  const others = useMemo(() => OTHER_TRAINERS.filter((t) => matches(t, query, region, difficulty)), [query, region, difficulty]);
  const total = champions.length + others.length;
  const filtered = query !== '' || region !== 'all' || difficulty !== 'all';
  const wins = hydrated ? stats.trainersDefeated : undefined;

  const reset = () => {
    setQuery('');
    setRegion('all');
    setDifficulty('all');
  };

  return (
    <div className="space-y-8">
      <div className="ds-panel-flat flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="trainer-search" className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Search
          </label>
          <input
            id="trainer-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, title, region or Pokémon…"
            autoComplete="off"
            className="w-full rounded-ds border-2 border-border bg-surface-2 px-3 py-2 text-sm font-bold text-text shadow-[inset_2px_2px_0_rgba(255,255,255,0.1),inset_-2px_-2px_0_rgba(0,0,0,0.3)] placeholder:text-muted/70 hover:border-border-light"
          />
        </div>
        <Select<RegionFilter>
          label="Region"
          value={region}
          onChange={setRegion}
          options={[{ value: 'all', label: 'All regions' }, ...regions.map((r) => ({ value: r, label: r }))]}
          className="md:w-44"
        />
        <Select<DifficultyFilter>
          label="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={DIFFICULTY_OPTIONS}
          className="md:w-44"
        />
        <Button variant="ghost" onClick={reset} disabled={!filtered} className="md:mb-0.5">
          Clear
        </Button>
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {total} {total === 1 ? 'trainer' : 'trainers'}
        {filtered ? ' match your filters' : ''}
      </p>

      {total === 0 ? (
        <EmptyState
          title="No trainers found"
          description="Try a different name, region or difficulty."
          action={
            <Button variant="secondary" onClick={reset}>
              Clear filters
            </Button>
          }
        />
      ) : null}

      {champions.length > 0 ? (
        <section className="space-y-4" aria-labelledby="champions-heading">
          <Heading level={2} id="champions-heading" kicker={`${champions.length} of ${CHAMPIONS.length}`}>
            Champions
          </Heading>
          <TrainerGrid trainers={champions} wins={wins} />
        </section>
      ) : null}

      {others.length > 0 ? (
        <section className="space-y-4" aria-labelledby="famous-heading">
          <Heading level={2} id="famous-heading" kicker={`${others.length} of ${OTHER_TRAINERS.length}`}>
            Famous Trainers
          </Heading>
          <TrainerGrid trainers={others} wins={wins} />
        </section>
      ) : null}
    </div>
  );
}
