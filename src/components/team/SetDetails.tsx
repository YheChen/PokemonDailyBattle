'use client';
import { useState, type ReactNode } from 'react';
import type { PokemonSet } from '@pkmn/sim';
import type { ModdedDex } from '@/lib/data/dex';
import { assets } from '@/lib/assets/provider';
import { cn } from '@/components/ui/cn';

export interface SetDetailsProps {
  set: PokemonSet;
  dex: ModdedDex | null;
  className?: string;
}

const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

/** "252 Atk / 252 Spe / 4 HP" (largest investments first, zeros omitted). */
export function summarizeEvs(evs: PokemonSet['evs'] | undefined): string {
  if (!evs) return '—';
  const parts = STAT_ORDER.filter((k) => (evs[k] ?? 0) > 0)
    .sort((a, b) => (evs[b] ?? 0) - (evs[a] ?? 0))
    .map((k) => `${evs[k]} ${STAT_LABEL[k]}`);
  return parts.length ? parts.join(' / ') : 'No EVs';
}

/** Nature with its stat changes, e.g. "Jolly (+Spe −SpA)". */
export function describeNature(dex: ModdedDex | null, nature: string): { name: string; detail: string } {
  const n = dex?.natures.get(nature);
  if (!n?.exists) return { name: nature || 'Hardy', detail: '' };
  const detail = n.plus && n.minus ? `+${STAT_LABEL[n.plus]} −${STAT_LABEL[n.minus]}` : 'Neutral';
  return { name: n.name, detail };
}

/**
 * Ability, item, nature and EV summary for a set. Ability and item show their short description in
 * a hover/focus popover.
 */
export function SetDetails({ set, dex, className }: SetDetailsProps) {
  const ability = dex?.abilities.get(set.ability);
  const item = set.item ? dex?.items.get(set.item) : undefined;
  const nature = describeNature(dex, set.nature);
  const itemName = item?.exists ? item.name : set.item || 'No item';

  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs', className)}>
      <dt className="font-extrabold uppercase tracking-wide text-muted">Ability</dt>
      <dd>
        <HoverDetail label={ability?.exists ? ability.name : set.ability || '—'} detail={ability?.exists ? ability.shortDesc || ability.desc : ''} />
      </dd>
      <dt className="font-extrabold uppercase tracking-wide text-muted">Item</dt>
      <dd>
        <HoverDetail
          label={
            <span className="inline-flex items-center gap-1">
              {set.item ? <ItemIcon name={set.item} /> : null}
              <span>{itemName}</span>
            </span>
          }
          detail={item?.exists ? item.shortDesc || item.desc : ''}
        />
      </dd>
      <dt className="font-extrabold uppercase tracking-wide text-muted">Nature</dt>
      <dd>
        <span className="font-bold">{nature.name}</span>
        {nature.detail ? <span className="ml-1 font-pixel text-base leading-none text-muted">{nature.detail}</span> : null}
      </dd>
      <dt className="font-extrabold uppercase tracking-wide text-muted">EVs</dt>
      <dd className="font-pixel text-base leading-none text-text">{summarizeEvs(set.evs)}</dd>
    </dl>
  );
}

/** Inline label with a popover shown on hover and keyboard focus (no nested buttons). */
function HoverDetail({ label, detail }: { label: ReactNode; detail: string }) {
  if (!detail) return <span className="font-bold">{label}</span>;
  return (
    <span className="group relative inline-block">
      <span tabIndex={0} className="cursor-help border-b border-dotted border-border-light font-bold outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow">
        {label}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-56 rounded-ds border-2 border-border bg-bg p-2 text-[0.7rem] font-semibold leading-snug text-text shadow-ds group-hover:block group-focus-within:block"
      >
        {detail}
      </span>
    </span>
  );
}

/** Item sprite from the asset provider; hides itself when the icon is missing. */
export function ItemIcon({ name, size = 20 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = assets.itemSprite(name);
  if (failed === src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(src)}
      className="sprite inline-block shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
