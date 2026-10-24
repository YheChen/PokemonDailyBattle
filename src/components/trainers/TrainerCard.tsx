import Link from 'next/link';
import type { Trainer } from '@/data/trainers/types';
import { Badge } from '@/components/ui/Badge';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { Stars } from '@/components/ui/Stars';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { cn } from '@/components/ui/cn';

export interface TrainerCardProps {
  trainer: Trainer;
  /** Show the signature Pokémon as a menu sprite instead of a party icon. Default false. */
  bigSprite?: boolean;
  /** Mark the card (e.g. "Today's challenger"). */
  highlight?: boolean;
  /** Number of wins against this trainer (shows a badge when > 0). */
  wins?: number;
  className?: string;
}

/**
 * Trainer summary card. The whole card links to `/trainers/<id>` (stretched link);
 * the "Battle" button links to `/battle?trainer=<id>`.
 */
export function TrainerCard({ trainer, bigSprite, highlight, wins, className }: TrainerCardProps) {
  return (
    <article
      className={cn(
        'ds-panel group relative flex flex-col gap-3 p-3 transition-transform duration-150 hover:-translate-y-0.5 focus-within:-translate-y-0.5',
        highlight && 'border-yellow',
        className,
      )}
      style={{ ['--accent' as string]: trainer.accent }}
    >
      <div className="flex items-start gap-3">
        <TrainerPortrait avatar={trainer.avatar} name={trainer.name} size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-muted">{trainer.title}</p>
          <h3 className="truncate font-display text-xs uppercase leading-relaxed">
            <Link
              href={`/trainers/${trainer.id}`}
              className="after:absolute after:inset-0 after:z-0 after:rounded-ds focus:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-yellow"
            >
              {trainer.name}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted">{trainer.subtitle}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="outline">{trainer.region}</Badge>
            <Stars value={trainer.difficulty} size={12} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t-2 border-border/60 pt-3">
        <div className="flex items-center gap-2">
          <span className="rounded border border-border bg-bg/60 p-0.5" title={`Signature: ${trainer.signature}`}>
            {bigSprite ? (
              <PokemonSprite species={trainer.signature} variant="menu" size={48} />
            ) : (
              <PokemonSprite species={trainer.signature} variant="icon" />
            )}
          </span>
          <span className="text-xs">
            <span className="block text-[0.6rem] font-extrabold uppercase tracking-wider text-muted">Signature</span>
            <span className="font-bold">{trainer.signature}</span>
          </span>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          {wins ? <Badge tone="green">{wins}W</Badge> : null}
          <Link href={`/battle?trainer=${encodeURIComponent(trainer.id)}`} className="btn btn-primary btn-sm">
            Battle
          </Link>
        </div>
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-0 h-0.5 rounded-b opacity-70"
        style={{ backgroundColor: trainer.accent }}
      />
    </article>
  );
}
