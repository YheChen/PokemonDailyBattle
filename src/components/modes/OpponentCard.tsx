import type { ReactNode } from 'react';
import type { Trainer } from '@/data/trainers/types';
import { getArena } from '@/data/trainers';
import { DIFFICULTY_LABELS } from '@/lib/game/results';
import { Badge } from '@/components/ui/Badge';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { Stars } from '@/components/ui/Stars';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { cn } from '@/components/ui/cn';

export interface OpponentCardProps {
  trainer: Trainer;
  /** Small label above the name (e.g. "Today's challenger", "Stage 3 of 23"). */
  kicker?: ReactNode;
  /** Number of wins against this trainer (shows a badge when > 0). */
  wins?: number;
  /** Shows the six party icons. Default true. */
  showTeam?: boolean;
  /** Right-hand content (buttons, countdown). */
  aside?: ReactNode;
  /** Extra rows under the summary. */
  children?: ReactNode;
  className?: string;
}

/**
 * The opponent summary used by every game mode before a battle: portrait, title, region, difficulty,
 * AI rating, arena, the six party icons and the first intro line. Contains no links so it can sit in
 * a flow without sending the player elsewhere.
 */
export function OpponentCard({ trainer, kicker, wins, showTeam = true, aside, children, className }: OpponentCardProps) {
  const arena = getArena(trainer.arena);
  const intro = trainer.dialogue.intro[0];
  return (
    <section
      aria-label={`Opponent: ${trainer.title} ${trainer.name}`}
      className={cn('ds-panel-light relative overflow-hidden p-4', className)}
      style={{ ['--accent' as string]: trainer.accent }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" style={{ backgroundColor: trainer.accent }} />
      <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
        <TrainerPortrait avatar={trainer.avatar} name={trainer.name} size={112} className="animate-pop-in" />
        <div className="min-w-0">
          {kicker ? <p className="mb-1 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-yellow">{kicker}</p> : null}
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-muted">
            {trainer.title} · {trainer.region}
          </p>
          <h2 className="mt-1 font-display text-sm uppercase leading-relaxed sm:text-base">{trainer.name}</h2>
          <p className="text-sm text-muted">{trainer.subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Stars value={trainer.difficulty} size={14} />
            <Badge tone="outline">AI: {DIFFICULTY_LABELS[trainer.ai]}</Badge>
            <Badge tone="outline">{arena.name}</Badge>
            {wins ? <Badge tone="green">{wins}W</Badge> : null}
          </div>
          {showTeam ? (
            <ul className="mt-3 flex flex-wrap gap-1" aria-label={`${trainer.name}'s team`}>
              {trainer.team.map((p, i) => (
                <li key={`${p.species}-${i}`} className="rounded border border-border bg-bg/60 p-0.5" title={p.species}>
                  <PokemonSprite species={p.species} variant="icon" alt={p.species} />
                </li>
              ))}
            </ul>
          ) : null}
          {intro ? <p className="mt-3 font-pixel text-lg leading-tight text-text/90">“{intro}”</p> : null}
          {children}
        </div>
        {aside ? <div className="flex flex-col gap-2 md:min-w-52">{aside}</div> : null}
      </div>
    </section>
  );
}
