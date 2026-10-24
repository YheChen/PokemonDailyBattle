import Link from 'next/link';
import { TRAINERS, getTrainer } from '@/data/trainers';
import { TrainerPortrait } from '@/components/ui/TrainerPortrait';
import { Badge } from '@/components/ui/Badge';

export interface TrainersDefeatedProps {
  /** trainerId → wins. */
  defeated: Record<string, number>;
}

/** List of every trainer the player has beaten, most wins first. */
export function TrainersDefeated({ defeated }: TrainersDefeatedProps) {
  const rows = Object.entries(defeated)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count, trainer: getTrainer(id) }))
    .sort((a, b) => b.count - a.count || (a.trainer?.name ?? a.id).localeCompare(b.trainer?.name ?? b.id));

  if (rows.length === 0) {
    return <p className="font-pixel text-xl leading-tight text-muted">No trainers defeated yet. Your first victory goes here.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {rows.length} of {TRAINERS.length} trainers defeated
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ id, count, trainer }) => (
          <li key={id}>
            <Link
              href={`/trainers/${encodeURIComponent(id)}`}
              className="flex items-center gap-3 rounded-ds border-2 border-border bg-bg/50 p-2 transition-colors hover:border-border-light hover:bg-surface-2"
            >
              <TrainerPortrait avatar={trainer?.avatar ?? id} name={trainer?.name ?? id} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{trainer?.name ?? id}</span>
                <span className="block truncate text-xs text-muted">{trainer?.subtitle ?? 'Unknown trainer'}</span>
              </span>
              <Badge tone="green">{count}W</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
