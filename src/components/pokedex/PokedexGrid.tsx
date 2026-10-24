import { EmptyState } from '@/components/ui/EmptyState';
import type { PokedexEntry } from '@/lib/data/pokedex';
import { PokedexCard } from './PokedexCard';

export interface PokedexGridProps {
  entries: PokedexEntry[];
}

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

/** Responsive grid of Pokédex cards. */
export function PokedexGrid({ entries }: PokedexGridProps) {
  if (entries.length === 0) {
    return <EmptyState title="No Pokémon found" description="Try a different name, or clear some of the generation and type filters." />;
  }
  return (
    <ul className={GRID} aria-label="Pokémon">
      {entries.map((e) => (
        <li key={e.id} className="contents">
          <PokedexCard entry={e} />
        </li>
      ))}
    </ul>
  );
}

/** Shimmering placeholder grid shown while the dex loads. */
export function PokedexGridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ds-panel flex flex-col items-center gap-2 p-3">
          <div className="shine h-3 w-full rounded bg-surface-2" />
          <div className="shine size-24 rounded-ds bg-surface-2" />
          <div className="shine h-3 w-3/4 rounded bg-surface-2" />
          <div className="shine h-4 w-1/2 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
