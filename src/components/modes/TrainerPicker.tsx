'use client';
import { useMemo, useState } from 'react';
import { TRAINERS } from '@/data/trainers';
import type { Region, Trainer } from '@/data/trainers/types';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { Select } from '@/components/ui/Select';
import { Stars } from '@/components/ui/Stars';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { cn } from '@/components/ui/cn';

export interface TrainerPickerProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Trainers to offer. Defaults to every trainer. */
  trainers?: Trainer[];
  /** trainerId → wins, for the badge. */
  wins?: Record<string, number>;
  className?: string;
}

type RegionFilter = Region | 'all';

/**
 * Selectable trainer grid with a search box and a region filter. Tiles are buttons (no links) so the
 * whole tile selects the trainer.
 */
export function TrainerPicker({ selectedId, onSelect, trainers = TRAINERS, wins, className }: TrainerPickerProps) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<RegionFilter>('all');

  const regions = useMemo(() => {
    const seen = new Set<Region>();
    for (const t of trainers) seen.add(t.region);
    return [...seen].sort();
  }, [trainers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trainers.filter((t) => {
      if (region !== 'all' && t.region !== region) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        t.signature.toLowerCase().includes(q)
      );
    });
  }, [trainers, query, region]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-extrabold uppercase tracking-wide text-muted">Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, title or signature Pokémon…"
            className="w-full rounded-ds border-2 border-border bg-surface-2 px-3 py-2 text-sm font-bold text-text placeholder:text-muted/70 shadow-[inset_2px_2px_0_rgba(255,255,255,0.1),inset_-2px_-2px_0_rgba(0,0,0,0.3)] hover:border-border-light"
          />
        </label>
        <Select<RegionFilter>
          label="Region"
          value={region}
          onChange={setRegion}
          options={[{ value: 'all', label: 'All regions' }, ...regions.map((r) => ({ value: r, label: r }))]}
          className="sm:w-48"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No trainers found" description="Try a different name or clear the region filter." />
      ) : (
        <ul role="listbox" aria-label="Choose an opponent" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => {
            const selected = t.id === selectedId;
            return (
              <li key={t.id} role="presentation" className="flex">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(t.id)}
                  className={cn(
                    'ds-panel relative flex w-full flex-col gap-3 p-3 text-left transition-transform duration-150 hover:-translate-y-0.5 hover:brightness-110',
                    'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-yellow',
                    selected && 'border-yellow ring-2 ring-yellow/40',
                  )}
                  style={{ ['--accent' as string]: t.accent }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 h-0.5 rounded-b opacity-70" style={{ backgroundColor: t.accent }} />
                  {selected ? (
                    <span className="absolute -top-3 right-3 rounded-sm border-2 border-[#1a1a1a] bg-yellow px-2 py-0.5 font-display text-[0.55rem] uppercase text-[#1a1a1a] shadow-ds-flat">
                      Selected
                    </span>
                  ) : null}
                  <span className="flex items-start gap-3">
                    <TrainerPortrait avatar={t.avatar} name={t.name} size={64} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-muted">{t.title}</span>
                      <span className="block truncate font-display text-xs uppercase leading-relaxed">{t.name}</span>
                      <span className="block truncate text-xs text-muted">{t.subtitle}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone="outline">{t.region}</Badge>
                        <Stars value={t.difficulty} size={12} />
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2 border-t-2 border-border/60 pt-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="rounded border border-border bg-bg/60 p-0.5">
                        <PokemonSprite species={t.signature} variant="icon" alt="" />
                      </span>
                      <span className="font-bold">{t.signature}</span>
                    </span>
                    {wins?.[t.id] ? <Badge tone="green">{wins[t.id]}W</Badge> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
