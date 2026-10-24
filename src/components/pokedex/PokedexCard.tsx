import Link from 'next/link';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { cn } from '@/components/ui/cn';
import { formatDexNumber, type PokedexEntry } from '@/lib/data/pokedex';

export interface PokedexCardProps {
  entry: PokedexEntry;
  className?: string;
}

const LEGENDARY_LABEL: Record<PokedexEntry['legendary'], string | null> = {
  none: null,
  sub: 'Legendary',
  restricted: 'Legendary',
  mythical: 'Mythical',
  ultrabeast: 'Ultra Beast',
  paradox: 'Paradox',
};

/** Grid card linking to `/pokedex/<id>`: menu sprite, dex number, name, types and BST. */
export function PokedexCard({ entry, className }: PokedexCardProps) {
  const tag = LEGENDARY_LABEL[entry.legendary];
  return (
    <Link
      href={`/pokedex/${entry.id}`}
      className={cn(
        'ds-panel group flex flex-col items-center gap-1.5 p-3 text-center transition-transform duration-150 hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-yellow',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        <span className="font-pixel text-base leading-none tabular-nums">{formatDexNumber(entry.num)}</span>
        {tag ? <span className="text-yellow">{tag}</span> : <span>Gen {entry.gen}</span>}
      </div>
      <div className="relative flex size-24 items-center justify-center rounded-ds bg-bg/50">
        <PokemonSprite species={entry.name} variant="menu" size={96} className="transition-transform duration-150 group-hover:scale-110" />
      </div>
      <h3 className="w-full truncate font-display text-[0.6rem] uppercase leading-relaxed sm:text-[0.65rem]" title={entry.name}>
        {entry.name}
      </h3>
      <div className="flex flex-wrap justify-center gap-1">
        {entry.types.map((t) => (
          <TypeBadge key={t} type={t} size="sm" />
        ))}
      </div>
      <p className="text-xs font-bold text-muted">
        BST <span className="font-pixel text-lg leading-none text-text">{entry.bst}</span>
      </p>
    </Link>
  );
}
