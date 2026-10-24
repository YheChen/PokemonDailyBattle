import type { ReactNode } from 'react';
import { PokeBall } from './PokeBall';
import { cn } from './cn';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Usually a <Button/>. */
  action?: ReactNode;
  /** Custom icon; defaults to a faded Poké Ball. */
  icon?: ReactNode;
  className?: string;
}

/** Centered placeholder for lists with no content. */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('ds-panel flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <div className="opacity-50 grayscale">{icon ?? <PokeBall size={48} />}</div>
      <h3 className="font-display text-xs uppercase sm:text-sm">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
