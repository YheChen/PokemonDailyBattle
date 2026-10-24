import type { ReactNode } from 'react';
import type { BattleResult } from '@/lib/battle/types';
import type { Trainer } from '@/data/trainers/types';
import { outcomeLabel, remainingCounts } from '@/lib/game/results';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { cn } from '@/components/ui/cn';

export interface ResultStat {
  label: string;
  value: ReactNode;
}

export interface ResultCardProps {
  result: BattleResult;
  trainer: Trainer;
  /** Ribbon title. Defaults to "Victory!" / "Defeat". */
  title?: ReactNode;
  /** Extra stat tiles after turns / remaining (streak, win %, …). */
  stats?: ResultStat[];
  /** Action buttons. */
  actions?: ReactNode;
  /** Content under the actions (e.g. the share block). */
  children?: ReactNode;
  className?: string;
}

/**
 * Post-battle summary: outcome banner, trainer portrait + dialogue line, turns, remaining Pokémon
 * and the player's team status.
 */
export function ResultCard({ result, trainer, title, stats = [], actions, children, className }: ResultCardProps) {
  const counts = remainingCounts(result);
  const outcome = outcomeLabel(result);
  const won = result.won;
  const line = (won ? trainer.dialogue.playerWins : trainer.dialogue.playerLoses)[0];

  const tiles: ResultStat[] = [
    { label: 'Result', value: <span className={won ? 'text-green' : 'text-accent'}>{outcome}</span> },
    { label: 'Turns', value: result.turns },
    { label: 'Your Pokémon left', value: `${counts.player} / ${counts.playerTotal}` },
    { label: `${trainer.name}'s left`, value: `${counts.opponent} / ${counts.opponentTotal}` },
    ...stats,
  ];

  return (
    <Panel title={title ?? (won ? 'Victory!' : 'Defeat')} light scanlines className={cn('animate-pop-in', className)}>
      <div className="relative z-[2] space-y-5">
        <div className={cn('rounded-ds border-2 px-4 py-3 text-center font-display text-sm uppercase sm:text-lg', won ? 'border-green/70 bg-green/15 text-green' : 'border-accent/70 bg-accent/15 text-accent')} role="status">
          {won ? `You defeated ${trainer.title} ${trainer.name}!` : result.forfeited ? `You forfeited against ${trainer.name}.` : `${trainer.title} ${trainer.name} wins.`}
        </div>

        <div className="flex items-start gap-4">
          <TrainerPortrait avatar={trainer.avatar} name={trainer.name} size={96} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-muted">
              {trainer.title} · {trainer.region}
            </p>
            <p className="font-display text-xs uppercase leading-relaxed sm:text-sm">{trainer.name}</p>
            {line ? <p className="mt-2 rounded-ds border-2 border-border bg-bg/60 px-3 py-2 font-pixel text-xl leading-tight text-text">“{line}”</p> : null}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-1 rounded-ds border-2 border-border bg-bg/40 px-2 py-3 text-center">
              <dt className="text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-muted">{t.label}</dt>
              <dd className="font-display text-sm text-yellow sm:text-base">{t.value}</dd>
            </div>
          ))}
        </dl>

        {result.playerTeamStatus.length ? (
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Your team</p>
            <ul className="flex flex-wrap gap-2">
              {result.playerTeamStatus.map((p, i) => (
                <li
                  key={`${p.species}-${i}`}
                  className={cn('flex items-center gap-1.5 rounded-ds border-2 px-2 py-1 text-xs font-bold', p.fainted ? 'border-accent/60 bg-accent/10 text-muted' : 'border-green/60 bg-green/10')}
                  title={`${p.species}: ${p.fainted ? 'fainted' : 'standing'}`}
                >
                  <span className={cn(p.fainted && 'opacity-50 grayscale')}>
                    <PokemonSprite species={p.species} variant="icon" alt="" />
                  </span>
                  <span className="max-w-24 truncate">{p.species}</span>
                  <span aria-hidden>{p.fainted ? '🔴' : '🟢'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {actions ? <div className="flex flex-wrap gap-2 border-t-2 border-border/60 pt-4">{actions}</div> : null}
        {children}
        <p className="text-right">
          <Badge tone="outline">{modeLabel(result.mode)}</Badge>
        </p>
      </div>
    </Panel>
  );
}

export function modeLabel(mode: BattleResult['mode']): string {
  switch (mode) {
    case 'daily':
      return 'Daily challenge';
    case 'free':
      return 'Free Battle';
    case 'boss-rush':
      return 'Boss Rush';
    case 'custom':
      return 'Custom Battle';
    default:
      return mode;
  }
}
