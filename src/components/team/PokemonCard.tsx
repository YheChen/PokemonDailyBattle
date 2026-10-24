'use client';
import type { KeyboardEvent } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import type { ModdedDex } from '@/lib/data/dex';
import { Badge } from '@/components/ui/Badge';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { cn } from '@/components/ui/cn';
import { MoveRow } from './MoveRow';
import { SetDetails } from './SetDetails';

export interface PokemonCardProps {
  set: PokemonSet;
  /** Party index (0-based). */
  index: number;
  /** Highlights the card as the chosen lead. */
  isLead?: boolean;
  /** When given, the card is selectable (click / Enter / Space). */
  onSelect?: (index: number) => void;
  dex: ModdedDex | null;
  /** Optional role label from the generator (e.g. "Physical Sweeper"). */
  role?: string;
  className?: string;
}

/**
 * Full set card: animated front sprite, name/level/types, ability, item, nature, EVs and the four moves.
 * Acts as a radio option for the lead when `onSelect` is given.
 */
export function PokemonCard({ set, index, isLead, onSelect, dex, role, className }: PokemonCardProps) {
  const species = dex?.species.get(set.species);
  const types = species?.exists ? species.types : [];
  const displayName = set.name && set.name !== set.species ? `${set.name} (${set.species})` : set.species;
  const selectable = !!onSelect;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!onSelect) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(index);
    }
  };

  return (
    <article
      role={selectable ? 'radio' : undefined}
      aria-checked={selectable ? !!isLead : undefined}
      aria-label={selectable ? `${set.species}${isLead ? ' (lead)' : ''}` : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? () => onSelect?.(index) : undefined}
      onKeyDown={selectable ? onKeyDown : undefined}
      className={cn(
        'ds-panel relative flex flex-col gap-3 p-3 outline-none transition-transform duration-150',
        selectable && 'cursor-pointer hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-yellow',
        isLead && 'border-yellow ring-2 ring-yellow/40',
        className,
      )}
      data-lead={isLead ? 'true' : undefined}
    >
      {isLead ? (
        <span className="absolute -top-3 left-3 z-[2] rounded-sm border-2 border-[#1a1a1a] bg-yellow px-2 py-0.5 font-display text-[0.55rem] uppercase text-[#1a1a1a] shadow-ds-flat">
          Lead
        </span>
      ) : null}
      <span className="absolute right-2 top-2 font-pixel text-base leading-none text-muted" aria-hidden>
        #{index + 1}
      </span>

      <div className="flex items-start gap-3">
        <div className="flex size-24 shrink-0 items-end justify-center rounded-ds border-2 border-border bg-bg/60 shadow-[inset_2px_2px_0_rgba(255,255,255,0.08)]">
          <PokemonSprite species={set.species} shiny={set.shiny} variant="front" size={88} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="truncate font-display text-[0.7rem] uppercase leading-relaxed sm:text-xs" title={displayName}>
            {displayName}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="outline">Lv. {set.level}</Badge>
            {set.gender === 'M' || set.gender === 'F' ? (
              <span className={cn('font-pixel text-lg leading-none', set.gender === 'M' ? 'text-blue' : 'text-[#ff8fb3]')} aria-label={set.gender === 'M' ? 'Male' : 'Female'}>
                {set.gender === 'M' ? '♂' : '♀'}
              </span>
            ) : null}
            {set.shiny ? <Badge tone="yellow">Shiny</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-1">
            {types.length ? types.map((t) => <TypeBadge key={t} type={t} size="sm" />) : <span className="type-badge type-badge-sm bg-surface-2">…</span>}
          </div>
          {role ? <p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">{role}</p> : null}
        </div>
      </div>

      <SetDetails set={set} dex={dex} />

      <ul className="grid gap-1" aria-label={`${set.species} moves`}>
        {set.moves.slice(0, 4).map((m, i) => (
          <MoveRow key={`${m}-${i}`} move={m} dex={dex} />
        ))}
      </ul>
    </article>
  );
}

/** Skeleton used while a team is generating. */
export function PokemonCardSkeleton() {
  return (
    <div className="ds-panel flex flex-col gap-3 p-3" aria-hidden>
      <div className="flex items-start gap-3">
        <div className="shine size-24 shrink-0 rounded-ds" />
        <div className="flex-1 space-y-2">
          <div className="shine h-4 w-3/4 rounded" />
          <div className="shine h-3 w-1/3 rounded" />
          <div className="shine h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="shine h-3 w-2/3 rounded" />
        <div className="shine h-3 w-1/2 rounded" />
        <div className="shine h-3 w-3/5 rounded" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="shine h-6 w-full rounded" />
        ))}
      </div>
    </div>
  );
}
