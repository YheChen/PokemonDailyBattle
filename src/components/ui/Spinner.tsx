import { PokeBall } from './PokeBall';
import { cn } from './cn';

export interface SpinnerProps {
  /** Pixel size. Default 32. */
  size?: number;
  /** Visible label under the spinner. */
  label?: string;
  className?: string;
}

/** Spinning Poké Ball loading indicator. */
export function Spinner({ size = 32, label, className }: SpinnerProps) {
  return (
    <div className={cn('inline-flex flex-col items-center gap-3', className)} role="status" aria-live="polite">
      <PokeBall size={size} className="animate-spin-slow" />
      <span className={cn('font-pixel text-xl text-muted', !label && 'sr-only')}>{label ?? 'Loading…'}</span>
    </div>
  );
}
