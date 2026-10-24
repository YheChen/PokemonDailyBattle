import { cn } from './cn';

export interface PokeBallProps {
  /** Pixel size (width = height). Default 24. */
  size?: number;
  className?: string;
  /** Accessible title; omit for a decorative icon. */
  title?: string;
}

/** Inline Poké Ball SVG used for the logo, spinner and placeholders. */
export function PokeBall({ size = 24, className, title }: PokeBallProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="32" cy="32" r="29" fill="#e63946" stroke="#1a1a1a" strokeWidth="4" />
      <path d="M3 32 A29 29 0 0 0 61 32 L3 32 Z" fill="#f1f3ff" />
      <rect x="3" y="29.5" width="58" height="5" fill="#1a1a1a" />
      <circle cx="32" cy="32" r="10" fill="#f1f3ff" stroke="#1a1a1a" strokeWidth="4" />
      <circle cx="32" cy="32" r="4.5" fill="#1a1a1a" />
      <circle cx="30" cy="30" r="1.6" fill="#f1f3ff" opacity="0.8" />
    </svg>
  );
}
