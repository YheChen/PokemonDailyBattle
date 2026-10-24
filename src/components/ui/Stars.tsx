import { cn } from './cn';

export interface StarsProps {
  /** Filled stars (1–5). */
  value: number;
  /** Total stars. Default 5. */
  max?: number;
  /** Pixel size of a star. Default 14. */
  size?: number;
  /** Accessible label prefix. Default "Difficulty". */
  label?: string;
  className?: string;
}

/** Difficulty rating rendered as pixel stars. */
export function Stars({ value, max = 5, size = 14, label = 'Difficulty', className }: StarsProps) {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <span className={cn('stars', className)} role="img" aria-label={`${label} ${filled} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} empty={i >= filled} />
      ))}
    </span>
  );
}

function Star({ size, empty }: { size: number; empty: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      className={cn(empty && 'star-empty')}
      shapeRendering="crispEdges"
    >
      <path
        fill="currentColor"
        d="M7 1h2v3h1v1h3v1h1v2h-1v1h-1v1h-1v3h1v2h-2v-1h-1v-1H7v1H6v1H4v-2h1v-3H4V9H3V8H2V6h1V5h3V4h1z"
      />
      {!empty ? <path fill="#fff" opacity="0.55" d="M7 3h1v2H7zM6 5h1v1H6z" /> : null}
    </svg>
  );
}
