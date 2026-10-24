import type { ReactNode } from 'react';
import { Heading } from '@/components/ui/Heading';
import { cn } from '@/components/ui/cn';

export interface ModeHeaderProps {
  /** Small label above the title (e.g. "Daily challenge"). */
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-hand content (countdown, badges, buttons). */
  aside?: ReactNode;
  className?: string;
}

/** Page header shared by the game modes. */
export function ModeHeader({ kicker, title, description, aside, className }: ModeHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 max-w-2xl">
        <Heading level={1} size="lg" kicker={kicker}>
          {title}
        </Heading>
        {description ? <p className="mt-2 text-sm text-muted sm:text-base">{description}</p> : null}
      </div>
      {aside ? <div className="flex shrink-0 flex-wrap items-center gap-3">{aside}</div> : null}
    </header>
  );
}
