import type { Trainer } from '@/data/trainers/types';
import { TRAINERS } from '@/data/trainers';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/components/ui/cn';
import { TrainerCard } from './TrainerCard';

export interface TrainerGridProps {
  /** Trainers to show. Defaults to every trainer. */
  trainers?: Trainer[];
  /** Trainer id to highlight (e.g. today's challenger). */
  highlightId?: string;
  /** Map of trainerId → win count for the badges. */
  wins?: Record<string, number>;
  bigSprites?: boolean;
  className?: string;
}

/** Responsive grid of {@link TrainerCard}s. */
export function TrainerGrid({ trainers = TRAINERS, highlightId, wins, bigSprites, className }: TrainerGridProps) {
  if (trainers.length === 0) {
    return <EmptyState title="No trainers" description="No trainers match the current filter." />;
  }
  return (
    <ul className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {trainers.map((t) => (
        <li key={t.id} className="flex">
          <TrainerCard
            trainer={t}
            highlight={t.id === highlightId}
            wins={wins?.[t.id]}
            bigSprite={bigSprites}
            className="w-full"
          />
        </li>
      ))}
    </ul>
  );
}
